import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiInsightStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { ConsentService } from '../consent/consent.service';
import { OpenAiAdapter } from '../integrations/openai.adapter';
import { BloodOcrAdapter } from '../integrations/blood-ocr.adapter';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';

type MarkerMap = Record<string, number>;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly consent: ConsentService,
    private readonly openai: OpenAiAdapter,
    private readonly bloodOcr: BloodOcrAdapter,
    private readonly intelligence: IntelligenceService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  private requireApproval() {
    return this.config.get<string>('AI_REQUIRE_COACH_APPROVAL') !== 'false';
  }

  private ageFromDob(dob?: Date | null) {
    if (!dob) return 32;
    const diff = Date.now() - dob.getTime();
    return Math.max(16, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
  }

  async dashboard(user: AuthUser) {
    const isCoach = user.role === 'COACH' || user.role === 'ADMIN';
    const [insights, bio, reports] = await Promise.all([
      this.prisma.aiInsight.findMany({
        where: {
          userId: user.id,
          ...(isCoach ? {} : { status: AiInsightStatus.APPROVED }),
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.biologicalAgeSnapshot.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.bloodReport.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      insights: insights.map((i) => ({
        ...i,
        body: i.coachEditedBody ?? i.body,
      })),
      biologicalAge: bio,
      bloodReports: reports,
      engine: this.openai.enabled ? 'openai+rules' : 'rules',
      requireCoachApproval: this.requireApproval(),
    };
  }

  async pendingForCoach(coach: AuthUser) {
    if (coach.role !== 'COACH' && coach.role !== 'ADMIN') {
      throw new ForbiddenException();
    }
    const links = await this.prisma.coachClient.findMany({
      where: { coachId: coach.id, active: true },
      select: { clientId: true },
    });
    const clientIds = links.map((l) => l.clientId);
    return this.prisma.aiInsight.findMany({
      where: {
        userId: { in: clientIds },
        status: AiInsightStatus.DRAFT,
      },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async reviewInsight(
    coach: AuthUser,
    id: string,
    body: { status: 'APPROVED' | 'REJECTED'; editedBody?: string },
  ) {
    if (coach.role !== 'COACH' && coach.role !== 'ADMIN') {
      throw new ForbiddenException();
    }
    const insight = await this.prisma.aiInsight.findUnique({ where: { id } });
    if (!insight) throw new NotFoundException('Insight not found');

    const link = await this.prisma.coachClient.findFirst({
      where: {
        coachId: coach.id,
        clientId: insight.userId,
        active: true,
      },
    });
    if (!link && coach.role !== 'ADMIN') throw new ForbiddenException();

    const updated = await this.prisma.aiInsight.update({
      where: { id },
      data: {
        status: body.status,
        coachEditedBody: body.editedBody ?? insight.coachEditedBody,
        reviewedById: coach.id,
        reviewedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: coach.id,
        userId: insight.userId,
        action: `ai.insight.${body.status.toLowerCase()}`,
        resource: 'AiInsight',
        resourceId: id,
        metaJson: JSON.stringify({ edited: Boolean(body.editedBody) }),
      },
    });

    if (body.status === 'APPROVED') {
      await this.notifications.pushToUser(insight.userId, {
        title: 'Coach approved an insight',
        body: updated.title,
        data: { insightId: id, type: 'ai_insight_approved' },
      });
    }

    return updated;
  }

  async generateInsights(user: AuthUser) {
    const allowed = await this.consent.hasGranted(user.id, 'ai_coaching');
    if (!allowed) {
      throw new ForbiddenException(
        'Consent required for ai_coaching. Grant it in Profile.',
      );
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    const [profileUser, recovery, nutritionLogs, sessions, latestBlood] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: user.id },
          include: { profile: true },
        }),
        this.prisma.recoverySnapshot.findUnique({
          where: { userId_dateKey: { userId: user.id, dateKey } },
        }),
        this.prisma.nutritionLog.findMany({
          where: { userId: user.id, dateKey },
          include: { food: true },
        }),
        this.prisma.workoutSession.findMany({
          where: { userId: user.id },
          orderBy: { scheduledFor: 'desc' },
          take: 5,
        }),
        this.prisma.bloodReport.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const calories = nutritionLogs.reduce(
      (sum, l) => sum + l.food.calories * l.servings,
      0,
    );
    const protein = nutritionLogs.reduce(
      (sum, l) => sum + l.food.proteinG * l.servings,
      0,
    );
    const completed = sessions.filter((s) => s.status === 'COMPLETED').length;
    const disorders = profileUser?.profile?.lifestyleDisorders ?? [];

    const draft: Array<{
      category: string;
      title: string;
      body: string;
      severity: string;
    }> = [];

    if ((recovery?.sleepHours ?? 0) < 7) {
      draft.push({
        category: 'recovery',
        title: 'Protect sleep debt',
        body: `Last night's sleep was ${recovery?.sleepHours ?? 'low'}h. Aim for 7.5h and keep caffeine earlier in the day.`,
        severity: 'warn',
      });
    } else {
      draft.push({
        category: 'recovery',
        title: 'Recovery window is open',
        body: 'Sleep looks adequate — a quality strength session is appropriate today.',
        severity: 'info',
      });
    }

    if (protein < 90) {
      draft.push({
        category: 'nutrition',
        title: 'Raise protein density',
        body: `Today's logged protein is ~${Math.round(protein)}g. Target 120g+ to support training and metabolic health.`,
        severity: 'warn',
      });
    } else {
      draft.push({
        category: 'nutrition',
        title: 'Protein intake on track',
        body: `Nice work — about ${Math.round(protein)}g protein logged against ~${Math.round(calories)} kcal.`,
        severity: 'info',
      });
    }

    if (completed === 0) {
      draft.push({
        category: 'training',
        title: 'Complete today’s session',
        body: 'No completed workouts yet this week. Open Train and finish Day 1 for momentum.',
        severity: 'warn',
      });
    } else {
      draft.push({
        category: 'training',
        title: 'Training consistency building',
        body: `${completed} recent session(s) completed. Keep RPE honest and recover between hard days.`,
        severity: 'info',
      });
    }

    if (disorders.includes('pcos') || disorders.includes('diabetes')) {
      draft.push({
        category: 'metabolic',
        title: 'Metabolic-aware meal timing',
        body: 'Given your lifestyle tags, prioritize protein + fiber at breakfast and a 10-minute walk after larger meals.',
        severity: 'info',
      });
    }

    if (latestBlood) {
      const bloodOk = await this.consent.hasGranted(
        user.id,
        'blood_report_analysis',
      );
      if (bloodOk) {
        const markers = JSON.parse(latestBlood.markersJson) as MarkerMap;
        if ((markers.ldl ?? 0) > 130) {
          draft.push({
            category: 'blood',
            title: 'LDL attention flag',
            body: `Latest report LDL is ${markers.ldl}. Emphasize fiber, walking volume, and coach review at your next consult.`,
            severity: 'alert',
          });
        }
        if ((markers.hba1c ?? 0) >= 5.7) {
          draft.push({
            category: 'blood',
            title: 'Glucose control focus',
            body: `HbA1c is ${markers.hba1c}. Keep carbs around training and lift strength volume 2–3x/week.`,
            severity: 'alert',
          });
        }
      }
    }

    let source = 'rules';
    if (this.openai.enabled) {
      source = 'openai+rules';
      for (const item of draft) {
        const enriched = await this.openai.enrichInsight(item.title, item.body);
        if (enriched) item.body = enriched;
      }
    }

    const status = this.requireApproval()
      ? AiInsightStatus.DRAFT
      : AiInsightStatus.APPROVED;

    await this.prisma.aiInsight.deleteMany({
      where: {
        userId: user.id,
        status: AiInsightStatus.DRAFT,
        NOT: {
          category: { in: ['cricket', 'injury_risk', 'predictive'] },
        },
      },
    });
    await this.prisma.aiInsight.createMany({
      data: draft.map((d) => ({
        userId: user.id,
        category: d.category,
        title: d.title,
        body: d.body,
        severity: d.severity,
        source,
        status,
      })),
    });

    let intelligence: unknown = null;
    try {
      intelligence = await this.intelligence.runForUser(user.id, user.id);
    } catch {
      intelligence = null;
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        userId: user.id,
        action: 'ai.insights.generate',
        resource: 'AiInsight',
        metaJson: JSON.stringify({
          count: draft.length,
          status,
          source,
          goals: profileUser?.profile?.goals ?? [],
          keyMetrics: {
            sleepHours: recovery?.sleepHours ?? null,
            calories: Math.round(calories),
            protein: Math.round(protein),
            completedSessions: completed,
            bloodReportId: latestBlood?.id ?? null,
          },
          intelligenceAttached: Boolean(intelligence),
        }),
      },
    });

    await this.notifications.pushToUser(user.id, {
      title:
        status === AiInsightStatus.DRAFT
          ? 'AI insights awaiting coach review'
          : 'AI insights refreshed',
      body: `${draft.length} personalized recommendations ${
        status === AiInsightStatus.DRAFT ? 'sent to your coach' : 'are ready'
      }.`,
      data: { type: 'ai_insights' },
    });

    const dash = await this.dashboard(user);
    return { ...dash, intelligence };
  }

  async calculateBiologicalAge(user: AuthUser) {
    const profileUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { profile: true },
    });
    const chrono = this.ageFromDob(profileUser?.profile?.dateOfBirth);
    const dateKey = new Date().toISOString().slice(0, 10);
    const recovery = await this.prisma.recoverySnapshot.findUnique({
      where: { userId_dateKey: { userId: user.id, dateKey } },
    });
    const blood = await this.prisma.bloodReport.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    let delta = 0;
    const factors: Array<{ key: string; impact: number; note: string }> = [];

    const sleep = recovery?.sleepHours ?? 7;
    if (sleep >= 7.5) {
      delta -= 1.2;
      factors.push({
        key: 'sleep',
        impact: -1.2,
        note: 'Strong sleep duration',
      });
    } else if (sleep < 6.5) {
      delta += 1.5;
      factors.push({ key: 'sleep', impact: 1.5, note: 'Sleep under 6.5h' });
    }

    const hrv = recovery?.hrvMs ?? 55;
    if (hrv >= 60) {
      delta -= 0.8;
      factors.push({ key: 'hrv', impact: -0.8, note: 'Favorable HRV' });
    } else if (hrv < 45) {
      delta += 1.0;
      factors.push({ key: 'hrv', impact: 1.0, note: 'Low HRV' });
    }

    const rhr = recovery?.restingHr ?? 60;
    if (rhr <= 55) {
      delta -= 0.7;
      factors.push({ key: 'rhr', impact: -0.7, note: 'Low resting HR' });
    } else if (rhr >= 72) {
      delta += 0.9;
      factors.push({ key: 'rhr', impact: 0.9, note: 'Elevated resting HR' });
    }

    if (blood) {
      const markers = JSON.parse(blood.markersJson) as MarkerMap;
      if ((markers.hba1c ?? 5.2) >= 5.7) {
        delta += 1.8;
        factors.push({ key: 'hba1c', impact: 1.8, note: 'Elevated HbA1c' });
      }
      if ((markers.ldl ?? 100) > 130) {
        delta += 1.0;
        factors.push({ key: 'ldl', impact: 1.0, note: 'Elevated LDL' });
      }
    }

    const biologicalAge = Math.round((chrono + delta) * 10) / 10;
    return this.prisma.biologicalAgeSnapshot.create({
      data: {
        userId: user.id,
        chronologicalAge: chrono,
        biologicalAge,
        deltaYears: Math.round(delta * 10) / 10,
        factorsJson: JSON.stringify(factors),
      },
    });
  }

  listBloodReports(user: AuthUser) {
    return this.prisma.bloodReport.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBloodReport(user: AuthUser, id: string) {
    const report = await this.prisma.bloodReport.findFirst({
      where: { id, userId: user.id },
    });
    if (!report) throw new NotFoundException('Blood report not found');
    return report;
  }

  async uploadBloodReport(
    user: AuthUser,
    body: {
      title?: string;
      fileName: string;
      markers?: Record<string, number>;
      ocrText?: string;
      imageBase64?: string;
      mimeType?: string;
    },
  ) {
    const allowed = await this.consent.hasGranted(
      user.id,
      'blood_report_analysis',
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Consent required for blood_report_analysis',
      );
    }

    const parsed = await this.bloodOcr.extractFromImage({
      fileName: body.fileName,
      ocrText: body.ocrText,
      markers: body.markers,
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
    });
    const markers = parsed.markers;

    let fileUrl = `local://blood/${body.fileName}`;
    let storageKey: string | null = null;
    if (body.imageBase64) {
      const buf = Buffer.from(body.imageBase64, 'base64');
      const stored = await this.storage.putObject({
        folder: 'blood',
        fileName: body.fileName,
        body: buf,
        contentType: body.mimeType ?? 'image/jpeg',
      });
      fileUrl = stored.fileUrl;
      storageKey = stored.storageKey;
    }

    const report = await this.prisma.bloodReport.create({
      data: {
        userId: user.id,
        title: body.title ?? 'Blood report',
        fileName: body.fileName,
        fileUrl,
        markersJson: JSON.stringify(markers),
        summary: parsed.summary,
        analyzedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        userId: user.id,
        action: 'blood_report.upload',
        resource: 'BloodReport',
        resourceId: report.id,
        metaJson: JSON.stringify({
          storageKey,
          ocrMode: parsed.mode,
          markerKeys: Object.keys(markers),
        }),
      },
    });

    await this.notifications.pushToUser(user.id, {
      title: 'Blood report analyzed',
      body: parsed.summary?.slice(0, 120) ?? 'Report saved',
      data: { type: 'blood_report', id: report.id },
    });

    return report;
  }
}
