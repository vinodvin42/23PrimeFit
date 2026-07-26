import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { ConsentService } from '../consent/consent.service';
import { WearableOauthAdapter } from '../integrations/wearable-oauth.adapter';
import { WearableAggregatorAdapter } from '../integrations/wearable-aggregator.adapter';
import { IntelligenceService } from '../intelligence/intelligence.service';

export type WearableSyncPayload = {
  dateKey?: string;
  provider?: string;
  deviceLabel?: string;
  sleepHours?: number;
  stressScore?: number;
  steps?: number;
  restingHr?: number;
  activeKcal?: number;
  hrvMs?: number;
  vo2Max?: number;
  spo2?: number;
  trainingLoad?: number;
};

@Injectable()
export class RecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
    private readonly config: ConfigService,
    private readonly oauth: WearableOauthAdapter,
    private readonly aggregator: WearableAggregatorAdapter,
    private readonly intelligence: IntelligenceService,
  ) {}

  private dateKey(d = new Date()) {
    return d.toISOString().slice(0, 10);
  }

  private insights(snapshot: {
    sleepHours: number | null;
    stressScore: number | null;
    hrvMs: number | null;
    steps: number | null;
    source: string;
  }) {
    return [
      snapshot.sleepHours != null && snapshot.sleepHours >= 7
        ? 'Sleep looks solid for training today.'
        : 'Prioritize an earlier wind-down tonight.',
      snapshot.stressScore != null && snapshot.stressScore < 40
        ? 'Stress is in a manageable range.'
        : 'Keep sessions technique-focused if stress is elevated.',
      snapshot.hrvMs != null && snapshot.hrvMs >= 50
        ? 'HRV suggests good recovery readiness.'
        : 'HRV is a bit low — consider lighter volume.',
      snapshot.steps != null && snapshot.steps >= 8000
        ? 'Step count supports metabolic health goals.'
        : 'A short walk can lift today’s activity load.',
      snapshot.source === 'mock'
        ? 'Showing simulated wearable data. Tap Sync to refresh from device adapters.'
        : `Last synced from ${snapshot.source}.`,
    ];
  }

  private recoveryScore(snapshot: {
    sleepHours: number | null;
    stressScore: number | null;
    hrvMs: number | null;
    restingHr: number | null;
  }) {
    let score = 50;
    if (snapshot.sleepHours != null) {
      score += Math.min(20, Math.max(-15, (snapshot.sleepHours - 6.5) * 8));
    }
    if (snapshot.stressScore != null) {
      score += Math.min(15, Math.max(-20, (40 - snapshot.stressScore) / 2));
    }
    if (snapshot.hrvMs != null) {
      score += Math.min(15, Math.max(-10, (snapshot.hrvMs - 45) / 3));
    }
    if (snapshot.restingHr != null) {
      score += Math.min(10, Math.max(-10, (65 - snapshot.restingHr) / 2));
    }
    return Math.round(Math.min(100, Math.max(0, score)));
  }

  async ensureToday(user: AuthUser) {
    const dateKey = this.dateKey();
    const existing = await this.prisma.recoverySnapshot.findUnique({
      where: { userId_dateKey: { userId: user.id, dateKey } },
    });
    if (existing) return existing;

    return this.prisma.recoverySnapshot.create({
      data: {
        userId: user.id,
        dateKey,
        sleepHours: 7.1,
        stressScore: 35,
        steps: 7800,
        restingHr: 60,
        activeKcal: 380,
        hrvMs: 55,
        vo2Max: 42,
        spo2: 97,
        trainingLoad: 48,
        source: 'mock',
        syncedAt: new Date(),
      },
    });
  }

  async ensureHistory(user: AuthUser, days = 7) {
    const existing = await this.prisma.recoverySnapshot.count({
      where: { userId: user.id },
    });
    if (existing >= days) return;

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const dateKey = this.dateKey(d);
      const jitter = (n: number) => n + ((i * 7) % 5) - 2;
      await this.prisma.recoverySnapshot.upsert({
        where: { userId_dateKey: { userId: user.id, dateKey } },
        update: {},
        create: {
          userId: user.id,
          dateKey,
          sleepHours: Math.round((6.5 + (i % 3) * 0.4) * 10) / 10,
          stressScore: Math.max(15, jitter(34)),
          steps: 6500 + i * 420,
          restingHr: Math.max(50, jitter(58)),
          activeKcal: 320 + i * 35,
          hrvMs: Math.max(35, jitter(58)),
          vo2Max: 40 + (i % 4),
          spo2: 96 + (i % 2),
          trainingLoad: 35 + i * 6,
          source: 'mock',
          syncedAt: new Date(),
        },
      });
    }
  }

  async today(user: AuthUser) {
    await this.ensureHistory(user);
    const snapshot = await this.ensureToday(user);
    const connections = await this.prisma.wearableConnection.findMany({
      where: { userId: user.id },
      orderBy: { provider: 'asc' },
    });

    return {
      ...snapshot,
      recoveryScore: this.recoveryScore(snapshot),
      insights: this.insights(snapshot),
      connections,
      aggregator: this.aggregator.status(),
      providers: [
        {
          id: 'apple_health',
          label: 'Apple Health / Watch',
          status: connections.find((c) => c.provider === 'apple_health')?.status,
        },
        {
          id: 'health_connect',
          label: 'Google Health Connect',
          status: connections.find((c) => c.provider === 'health_connect')
            ?.status,
        },
        {
          id: 'garmin',
          label: 'Garmin',
          status: connections.find((c) => c.provider === 'garmin')?.status,
        },
        {
          id: 'whoop',
          label: 'WHOOP',
          status: connections.find((c) => c.provider === 'whoop')?.status,
        },
      ],
    };
  }

  async history(user: AuthUser, days = 7) {
    await this.ensureHistory(user, days);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const sinceKey = this.dateKey(since);

    const items = await this.prisma.recoverySnapshot.findMany({
      where: { userId: user.id, dateKey: { gte: sinceKey } },
      orderBy: { dateKey: 'asc' },
    });

    return {
      days,
      items: items.map((item) => ({
        ...item,
        recoveryScore: this.recoveryScore(item),
      })),
    };
  }

  async sync(user: AuthUser, payload: WearableSyncPayload) {
    const allowed = await this.consent.hasGranted(user.id, 'wearable_sync');
    if (!allowed) {
      throw new ForbiddenException(
        'Consent required for wearable_sync. Grant it in Profile before syncing.',
      );
    }

    const provider = payload.provider || 'health_connect';
    const dateKey = payload.dateKey || this.dateKey();
    const now = new Date();

    const snapshot = await this.prisma.recoverySnapshot.upsert({
      where: { userId_dateKey: { userId: user.id, dateKey } },
      update: {
        sleepHours: payload.sleepHours,
        stressScore: payload.stressScore,
        steps: payload.steps,
        restingHr: payload.restingHr,
        activeKcal: payload.activeKcal,
        hrvMs: payload.hrvMs,
        vo2Max: payload.vo2Max,
        spo2: payload.spo2,
        trainingLoad: payload.trainingLoad,
        source: provider,
        syncedAt: now,
      },
      create: {
        userId: user.id,
        dateKey,
        sleepHours: payload.sleepHours ?? 7,
        stressScore: payload.stressScore ?? 30,
        steps: payload.steps ?? 8000,
        restingHr: payload.restingHr ?? 58,
        activeKcal: payload.activeKcal ?? 400,
        hrvMs: payload.hrvMs ?? 60,
        vo2Max: payload.vo2Max ?? 43,
        spo2: payload.spo2 ?? 97,
        trainingLoad: payload.trainingLoad ?? 50,
        source: provider,
        syncedAt: now,
      },
    });

    await this.prisma.wearableConnection.upsert({
      where: {
        userId_provider: { userId: user.id, provider },
      },
      update: {
        status: 'connected',
        lastSyncAt: now,
        deviceLabel: payload.deviceLabel ?? provider,
      },
      create: {
        userId: user.id,
        provider,
        status: 'connected',
        lastSyncAt: now,
        deviceLabel: payload.deviceLabel ?? provider,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        userId: user.id,
        action: 'wearable.sync',
        resource: 'RecoverySnapshot',
        resourceId: snapshot.id,
        metaJson: JSON.stringify({ provider, dateKey }),
      },
    });

    let intelligence: unknown = null;
    try {
      intelligence = await this.intelligence.runForUser(user.id, user.id);
    } catch {
      intelligence = null;
    }

    return {
      ...snapshot,
      recoveryScore: this.recoveryScore(snapshot),
      insights: this.insights(snapshot),
      intelligence,
    };
  }

  /** Simulates a HealthKit / Health Connect sample for demos (web/desktop). */
  async syncDemo(user: AuthUser, provider = 'health_connect') {
    const demoAllowed = this.config.get<string>('WEARABLE_DEMO') !== 'false';
    if (!demoAllowed) {
      throw new ForbiddenException('Demo wearable sync is disabled');
    }
    // Auto-grant demo consent so Recover tab works in AUTH_DEV_MODE demos.
    await this.consent.upsert(user, 'wearable_sync', true);
    const roll = Math.floor(Math.random() * 1000);
    return this.sync(user, {
      provider,
      deviceLabel:
        provider === 'apple_health'
          ? 'Apple Watch Ultra'
          : provider === 'garmin'
            ? 'Garmin'
            : provider === 'whoop'
              ? 'WHOOP'
              : 'Pixel Watch',
      sleepHours: Math.round((6.8 + (roll % 15) / 20) * 10) / 10,
      stressScore: 22 + (roll % 25),
      steps: 7200 + (roll % 4500),
      restingHr: 52 + (roll % 12),
      activeKcal: 350 + (roll % 280),
      hrvMs: 48 + (roll % 30),
      vo2Max: 41 + (roll % 8),
      spo2: 96 + (roll % 3),
      trainingLoad: 40 + (roll % 40),
    });
  }

  connections(user: AuthUser) {
    return this.prisma.wearableConnection.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
  }

  startOauth(user: AuthUser, provider: 'garmin' | 'whoop') {
    return this.oauth.start(provider, user.id);
  }

  async completeOauth(
    user: AuthUser,
    provider: 'garmin' | 'whoop',
    body: { code?: string; state?: string },
  ) {
    const result = await this.oauth.complete(provider, body.code, body.state);
    if (result.userId && result.userId !== user.id) {
      throw new ForbiddenException('OAuth state does not belong to this user');
    }
    const connected =
      result.status === 'connected' ||
      result.status === 'connected_stub' ||
      Boolean(result.accessToken);
    const metaJson = JSON.stringify({
      status: result.status,
      accessToken: result.accessToken ?? null,
      refreshToken: result.refreshToken ?? null,
      needsTokenExchange: result.needsTokenExchange ?? false,
      updatedAt: new Date().toISOString(),
    });
    await this.prisma.wearableConnection.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      update: {
        status: connected ? 'connected' : 'pending_oauth',
        deviceLabel: provider,
        lastSyncAt: new Date(),
        metaJson,
      },
      create: {
        userId: user.id,
        provider,
        status: connected ? 'connected' : 'pending_oauth',
        deviceLabel: provider,
        lastSyncAt: new Date(),
        metaJson,
      },
    });
    const { accessToken: _a, refreshToken: _r, ...safe } = result as {
      accessToken?: string;
      refreshToken?: string | null;
      [k: string]: unknown;
    };
    return { ...safe, connected };
  }
}
