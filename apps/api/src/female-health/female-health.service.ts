import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { ConsentService } from '../consent/consent.service';

type ProfileInput = {
  trackingEnabled?: boolean;
  typicalCycleLength?: number;
  typicalPeriodLength?: number;
  lastPeriodStart?: string;
};

const CONCERNING_SYMPTOMS = new Set([
  'severe_pain',
  'very_heavy_bleeding',
  'fainting',
  'pregnancy_concern',
  'self_harm',
]);

@Injectable()
export class FemaleHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  async profile(user: AuthUser) {
    await this.requireTracking(user.id);
    return this.prisma.femaleHealthProfile.findUnique({
      where: { userId: user.id },
    });
  }

  async upsertProfile(user: AuthUser, body: ProfileInput) {
    await this.requireTracking(user.id);
    this.validateLengths(body);
    const profile = await this.prisma.femaleHealthProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        trackingEnabled: body.trackingEnabled ?? true,
        typicalCycleLength: body.typicalCycleLength,
        typicalPeriodLength: body.typicalPeriodLength,
        lastPeriodStart: body.lastPeriodStart
          ? new Date(body.lastPeriodStart)
          : undefined,
      },
      update: {
        trackingEnabled: body.trackingEnabled,
        typicalCycleLength: body.typicalCycleLength,
        typicalPeriodLength: body.typicalPeriodLength,
        lastPeriodStart: body.lastPeriodStart
          ? new Date(body.lastPeriodStart)
          : undefined,
      },
    });
    await this.audit(
      user.id,
      user.id,
      'female_health.profile.updated',
      'FemaleHealthProfile',
      profile.id,
    );
    return profile;
  }

  async cycles(user: AuthUser) {
    await this.requireTracking(user.id);
    return this.prisma.cycleLog.findMany({
      where: { userId: user.id },
      orderBy: { periodStart: 'desc' },
      take: 24,
    });
  }

  async createCycle(
    user: AuthUser,
    body: { periodStart: string; periodEnd?: string; notes?: string },
  ) {
    await this.requireTracking(user.id);
    const periodStart = new Date(body.periodStart);
    if (Number.isNaN(periodStart.valueOf()))
      throw new NotFoundException('A valid period start is required');
    const cycle = await this.prisma.cycleLog.create({
      data: {
        userId: user.id,
        periodStart,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
        notes: body.notes,
      },
    });
    await this.prisma.femaleHealthProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        trackingEnabled: true,
        lastPeriodStart: periodStart,
      },
      update: { lastPeriodStart: periodStart },
    });
    await this.audit(
      user.id,
      user.id,
      'female_health.cycle.created',
      'CycleLog',
      cycle.id,
    );
    return cycle;
  }

  async checkIns(user: AuthUser) {
    await this.requireTracking(user.id);
    return this.prisma.symptomCheckIn.findMany({
      where: { userId: user.id },
      orderBy: { dateKey: 'desc' },
      take: 60,
    });
  }

  async createCheckIn(
    user: AuthUser,
    body: {
      dateKey?: string;
      symptoms?: string[];
      severity?: number;
      notes?: string;
    },
  ) {
    await this.requireTracking(user.id);
    const symptoms = [...new Set(body.symptoms ?? [])].slice(0, 20);
    const severity = Math.max(1, Math.min(10, Math.round(body.severity ?? 1)));
    const checkIn = await this.prisma.symptomCheckIn.create({
      data: {
        userId: user.id,
        dateKey: body.dateKey ?? new Date().toISOString().slice(0, 10),
        symptoms,
        severity,
        notes: body.notes,
      },
    });
    await this.audit(
      user.id,
      user.id,
      'female_health.check_in.created',
      'SymptomCheckIn',
      checkIn.id,
    );
    return { ...checkIn, careFlag: this.careFlag(symptoms, severity) };
  }

  async today(user: AuthUser) {
    await this.requireTracking(user.id);
    const [profile, cycles, checkIns] = await Promise.all([
      this.prisma.femaleHealthProfile.findUnique({
        where: { userId: user.id },
      }),
      this.prisma.cycleLog.findMany({
        where: { userId: user.id },
        orderBy: { periodStart: 'desc' },
        take: 8,
      }),
      this.prisma.symptomCheckIn.findMany({
        where: { userId: user.id },
        orderBy: { dateKey: 'desc' },
        take: 5,
      }),
    ]);
    const estimate = this.phaseEstimate(
      profile?.typicalCycleLength,
      profile?.lastPeriodStart,
      cycles.map((c) => c.periodStart),
    );
    return {
      profile,
      phase: estimate,
      suggestion: this.suggestionFor(estimate.phase),
      recentCheckIns: checkIns.map((item) => ({
        ...item,
        careFlag: this.careFlag(item.symptoms, item.severity),
      })),
      disclaimer:
        'Cycle-aware wellness guidance only. It does not diagnose, treat, or replace professional medical care.',
    };
  }

  async coachClientSummary(coach: AuthUser, clientId: string) {
    await this.assertCoachAccess(coach, clientId);
    if (
      !(await this.consent.hasGranted(clientId, 'female_health_coach_share'))
    ) {
      throw new ForbiddenException(
        'Client has not consented to female health coach sharing.',
      );
    }
    const client = { id: clientId } as AuthUser;
    return this.today(client);
  }

  private async requireTracking(userId: string) {
    await this.consent.requireGranted(userId, 'female_health_tracking');
  }

  private async assertCoachAccess(coach: AuthUser, clientId: string) {
    if (coach.role !== 'COACH' && coach.role !== 'ADMIN')
      throw new ForbiddenException('Coach role required');
    if (coach.role === 'ADMIN') return;
    const link = await this.prisma.coachClient.findFirst({
      where: { coachId: coach.id, clientId, active: true },
    });
    if (!link)
      throw new ForbiddenException('Client is not assigned to this coach.');
  }

  private phaseEstimate(
    length?: number | null,
    lastPeriodStart?: Date | null,
    cycleStarts: Date[] = [],
  ) {
    const cycleLength = length && length >= 21 && length <= 45 ? length : 28;
    const start = lastPeriodStart ?? cycleStarts[0];
    if (!start)
      return { phase: 'unknown', confidence: 'low', irregular: false };
    const day = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
    const phase =
      day <= 5
        ? 'menstrual'
        : day < cycleLength - 13
          ? 'follicular'
          : day < cycleLength - 1
            ? 'ovulatory'
            : 'luteal';
    const intervals = cycleStarts
      .slice(0, -1)
      .map((item, i) =>
        Math.round((item.getTime() - cycleStarts[i + 1].getTime()) / 86400000),
      );
    const irregular =
      intervals.length >= 2 &&
      Math.max(...intervals) - Math.min(...intervals) > 7;
    return {
      phase,
      cycleDay: day,
      estimatedCycleLength: cycleLength,
      confidence: lastPeriodStart ? 'medium' : 'low',
      irregular,
    };
  }

  private suggestionFor(phase: string) {
    const suggestions: Record<string, string> = {
      menstrual:
        'Consider flexible movement, hydration, and rest if that feels supportive today.',
      follicular:
        'If your energy feels good, choose the training plan that suits you and recover normally.',
      ovulatory:
        'Check in with your energy and comfort; adjust intensity based on how you feel.',
      luteal:
        'Plan a little recovery margin and prioritize sleep, regular meals, and manageable sessions.',
      unknown:
        'Log a cycle start to receive optional cycle-aware wellness suggestions.',
    };
    return suggestions[phase] ?? suggestions.unknown;
  }

  private careFlag(symptoms: string[], severity: number) {
    const concerning =
      symptoms.some((symptom) => CONCERNING_SYMPTOMS.has(symptom)) ||
      severity >= 8;
    return concerning
      ? {
          concerning: true,
          message:
            'Please seek professional care promptly, especially if symptoms are severe or worsening.',
        }
      : { concerning: false };
  }

  private validateLengths(body: ProfileInput) {
    if (
      body.typicalCycleLength != null &&
      (body.typicalCycleLength < 15 || body.typicalCycleLength > 60)
    ) {
      throw new ForbiddenException(
        'Typical cycle length must be between 15 and 60 days.',
      );
    }
  }

  private audit(
    actorId: string,
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
  ) {
    return this.prisma.auditLog.create({
      data: { actorId, userId, action, resource, resourceId },
    });
  }
}
