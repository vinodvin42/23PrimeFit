import { ForbiddenException, Injectable } from '@nestjs/common';
import { AiInsightStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { ConsentService } from '../consent/consent.service';
import { PrismaService } from '../prisma/prisma.service';

const MODEL_VERSION = 'healthspan-rules-v1';

@Injectable()
export class HealthspanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  async today(user: AuthUser) {
    await this.consent.requireGranted(user.id, 'healthspan_insights');
    const dateKey = new Date().toISOString().slice(0, 10);
    const baseline = await this.baseline(user.id);
    if (!baseline.ready) return { baseline, snapshot: null };

    const snapshot = await this.createOrRefresh(user.id, dateKey, baseline);
    return {
      baseline,
      snapshot: { ...snapshot, pillars: JSON.parse(snapshot.pillarsJson) },
      disclaimer:
        'Healthspan is a wellness estimate, not a medical assessment or biological-age diagnosis.',
    };
  }

  async history(user: AuthUser, from?: string, to?: string) {
    await this.consent.requireGranted(user.id, 'healthspan_insights');
    const toKey = to ?? new Date().toISOString().slice(0, 10);
    const fromKey =
      from ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const snapshots = await this.prisma.healthspanSnapshot.findMany({
      where: { userId: user.id, dateKey: { gte: fromKey, lte: toKey } },
      orderBy: { dateKey: 'asc' },
    });
    return {
      from: fromKey,
      to: toKey,
      snapshots: snapshots.map((item) => ({
        ...item,
        pillars: JSON.parse(item.pillarsJson),
      })),
    };
  }

  private async baseline(userId: string) {
    const [profile, recoveryCount, workoutCount, nutritionCount] =
      await Promise.all([
        this.prisma.profile.findUnique({ where: { userId } }),
        this.prisma.recoverySnapshot.count({ where: { userId } }),
        this.prisma.workoutSession.count({
          where: { userId, status: 'COMPLETED' },
        }),
        this.prisma.nutritionLog.count({ where: { userId } }),
      ]);
    const missing = [
      ...(profile?.dateOfBirth ? [] : ['date of birth']),
      ...(recoveryCount >= 3 ? [] : ['3 recovery check-ins']),
      ...(workoutCount + nutritionCount >= 3
        ? []
        : ['3 activity or nutrition logs']),
    ];
    return {
      ready: missing.length === 0,
      missing,
      coverage: {
        recoveryCount,
        workoutCount,
        nutritionCount,
        hasDateOfBirth: Boolean(profile?.dateOfBirth),
      },
    };
  }

  private async createOrRefresh(
    userId: string,
    dateKey: string,
    baseline: Awaited<ReturnType<HealthspanService['baseline']>>,
  ) {
    const [profile, recovery, workouts, nutrition, previous] =
      await Promise.all([
        this.prisma.profile.findUnique({ where: { userId } }),
        this.prisma.recoverySnapshot.findMany({
          where: { userId },
          orderBy: { dateKey: 'desc' },
          take: 14,
        }),
        this.prisma.workoutSession.count({
          where: {
            userId,
            status: 'COMPLETED',
            completedAt: { gte: new Date(Date.now() - 7 * 86400000) },
          },
        }),
        this.prisma.nutritionLog.count({
          where: {
            userId,
            loggedAt: { gte: new Date(Date.now() - 7 * 86400000) },
          },
        }),
        this.prisma.healthspanSnapshot.findFirst({
          where: { userId },
          orderBy: { dateKey: 'desc' },
        }),
      ]);
    if (!profile?.dateOfBirth)
      throw new ForbiddenException('Healthspan baseline is incomplete.');
    const avgSleep = recovery.length
      ? recovery.reduce((sum, r) => sum + (r.sleepHours ?? 0), 0) /
        recovery.length
      : 0;
    const avgStress = recovery.length
      ? recovery.reduce((sum, r) => sum + (r.stressScore ?? 5), 0) /
        recovery.length
      : 5;
    const pillars = {
      recovery: Math.round(
        Math.max(
          0,
          Math.min(100, 55 + (avgSleep - 6) * 12 - (avgStress - 5) * 4),
        ),
      ),
      movement: Math.min(100, 35 + workouts * 9),
      nutrition: Math.min(100, 35 + nutrition * 7),
      consistency: Math.min(100, 30 + recovery.length * 5),
    };
    const score = Number(
      (
        Object.values(pillars).reduce((sum, value) => sum + value, 0) / 4
      ).toFixed(1),
    );
    const chronologicalAge =
      (Date.now() - profile.dateOfBirth.getTime()) / (365.25 * 86400000);
    const biologicalAge = Number(
      (chronologicalAge + (50 - score) / 12).toFixed(1),
    );
    const pace = previous ? Number((score - previous.score).toFixed(1)) : 0;
    const trend = pace > 1 ? 'improving' : pace < -1 ? 'declining' : 'steady';
    const coverageConfidence =
      baseline.coverage.recoveryCount >= 7 ? 'medium' : 'low';
    const snapshot = await this.prisma.healthspanSnapshot.upsert({
      where: {
        userId_dateKey_modelVersion: {
          userId,
          dateKey,
          modelVersion: MODEL_VERSION,
        },
      },
      create: {
        userId,
        dateKey,
        score,
        biologicalAge,
        pace,
        trend,
        pillarsJson: JSON.stringify(pillars),
        coverageConfidence,
        modelVersion: MODEL_VERSION,
      },
      update: {
        score,
        biologicalAge,
        pace,
        trend,
        pillarsJson: JSON.stringify(pillars),
        coverageConfidence,
      },
    });
    await this.createHitlInsight(userId, dateKey, snapshot);
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        userId,
        action: 'healthspan.estimated',
        resource: 'HealthspanSnapshot',
        resourceId: snapshot.id,
        metaJson: JSON.stringify({ score, modelVersion: MODEL_VERSION }),
      },
    });
    return snapshot;
  }

  private async createHitlInsight(
    userId: string,
    dateKey: string,
    snapshot: { score: number; trend: string | null },
  ) {
    const existing = await this.prisma.aiInsight.findFirst({
      where: {
        userId,
        category: 'healthspan',
        createdAt: { gte: new Date(`${dateKey}T00:00:00.000Z`) },
      },
    });
    if (existing) return;
    await this.prisma.aiInsight.create({
      data: {
        userId,
        category: 'healthspan',
        title: 'Healthspan wellness snapshot',
        body: `Your wellness score is ${snapshot.score}/100 and the recent trend is ${snapshot.trend ?? 'steady'}. Review this with your coach as lifestyle guidance, not medical advice.`,
        severity: 'info',
        source: MODEL_VERSION,
        status: AiInsightStatus.DRAFT,
      },
    });
  }
}
