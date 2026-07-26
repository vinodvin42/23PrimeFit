import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type DailyFeatures = {
  dateKey: string;
  userId: string;
  goals: string[];
  lifestyleDisorders: string[];
  recovery7: Array<{
    dateKey: string;
    sleepHours: number | null;
    stressScore: number | null;
    hrvMs: number | null;
    trainingLoad: number | null;
    steps: number | null;
    restingHr: number | null;
  }>;
  recovery28: Array<{
    dateKey: string;
    sleepHours: number | null;
    trainingLoad: number | null;
    hrvMs: number | null;
    stressScore: number | null;
  }>;
  sessions7: Array<{
    dateKey: string;
    status: string;
    rpe: number | null;
    durationMin: number | null;
  }>;
  cricket7: Array<{
    dateKey: string;
    kind: string;
    overs: number | null;
    durationMin: number;
    rpe: number | null;
  }>;
  cricket28: Array<{
    dateKey: string;
    kind: string;
    overs: number | null;
    durationMin: number;
    rpe: number | null;
  }>;
  cricketRole: string | null;
  nutrition7: Array<{ calories: number; target: number | null; dateKey: string }>;
  plannedSessions3d: number;
  missedSessions7: number;
  featureHash: string;
};

function dateKeyOffset(base: string, daysBack: number) {
  const d = new Date(`${base}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class FeatureBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string, dateKey = new Date().toISOString().slice(0, 10)): Promise<DailyFeatures> {
    const from28 = dateKeyOffset(dateKey, 27);
    const from7 = dateKeyOffset(dateKey, 6);
    const to3 = dateKeyOffset(dateKey, -2);

    const [profile, recovery, sessions, cricket, cricketProfile, nutrition] =
      await Promise.all([
        this.prisma.profile.findUnique({ where: { userId } }),
        this.prisma.recoverySnapshot.findMany({
          where: { userId, dateKey: { gte: from28, lte: dateKey } },
          orderBy: { dateKey: 'asc' },
        }),
        this.prisma.workoutSession.findMany({
          where: { userId, createdAt: { gte: new Date(`${from7}T00:00:00.000Z`) } },
          orderBy: { createdAt: 'asc' },
          take: 40,
        }),
        this.prisma.cricketSession.findMany({
          where: { userId, dateKey: { gte: from28, lte: dateKey } },
          orderBy: { dateKey: 'asc' },
        }),
        this.prisma.cricketAthleteProfile.findUnique({ where: { userId } }),
        this.prisma.nutritionLog.findMany({
          where: { userId, loggedAt: { gte: new Date(`${from7}T00:00:00.000Z`) } },
          include: { food: true },
          take: 200,
        }),
      ]);

    const recoveryMapped = recovery.map((r) => ({
      dateKey: r.dateKey,
      sleepHours: r.sleepHours,
      stressScore: r.stressScore,
      hrvMs: r.hrvMs,
      trainingLoad: r.trainingLoad,
      steps: r.steps,
      restingHr: r.restingHr,
    }));

    const recovery7 = recoveryMapped.filter((r) => r.dateKey >= from7);
    const recovery28 = recoveryMapped.map((r) => ({
      dateKey: r.dateKey,
      sleepHours: r.sleepHours,
      trainingLoad: r.trainingLoad,
      hrvMs: r.hrvMs,
      stressScore: r.stressScore,
    }));

    const sessions7 = sessions.map((s) => ({
      dateKey: (s.completedAt ?? s.scheduledFor ?? s.createdAt)
        .toISOString()
        .slice(0, 10),
      status: s.status,
      rpe: s.perceivedEffort ?? null,
      durationMin: s.durationMin ?? null,
    }));

    const cricketMapped = cricket.map((c) => ({
      dateKey: c.dateKey,
      kind: c.kind,
      overs: c.overs,
      durationMin: c.durationMin,
      rpe: c.rpe,
    }));

    const calByDay = new Map<string, { calories: number; target: number | null }>();
    for (const log of nutrition) {
      const dk = log.loggedAt.toISOString().slice(0, 10);
      const prev = calByDay.get(dk) ?? { calories: 0, target: null };
      prev.calories += (log.food?.calories ?? 0) * (log.servings ?? 1);
      calByDay.set(dk, prev);
    }

    const missedSessions7 = sessions7.filter((s) => s.status === 'SKIPPED').length;
    const plannedSessions3d = await this.prisma.workoutSession.count({
      where: {
        userId,
        status: 'PLANNED',
        scheduledFor: {
          gte: new Date(`${dateKey}T00:00:00.000Z`),
          lte: new Date(`${to3}T23:59:59.000Z`),
        },
      },
    });

    const payload = {
      dateKey,
      userId,
      goals: profile?.goals ?? [],
      lifestyleDisorders: profile?.lifestyleDisorders ?? [],
      recovery7,
      recovery28,
      sessions7,
      cricket7: cricketMapped.filter((c) => c.dateKey >= from7),
      cricket28: cricketMapped,
      cricketRole: cricketProfile?.primaryRole ?? null,
      nutrition7: [...calByDay.entries()].map(([dk, v]) => ({
        dateKey: dk,
        calories: v.calories,
        target: v.target,
      })),
      plannedSessions3d,
      missedSessions7,
    };

    const featureHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 16);

    return { ...payload, featureHash };
  }
}
