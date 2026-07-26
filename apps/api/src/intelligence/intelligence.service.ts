import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiInsightStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { ConsentService } from '../consent/consent.service';
import { FeatureBuilderService } from './feature-builder.service';
import {
  MODEL_VERSION,
  runCricketRules,
  runInjuryRules,
  runPredictiveRules,
  type RuleSignal,
} from './rule-packs';

@Injectable()
export class IntelligenceService implements OnModuleInit {
  private readonly logger = new Logger(IntelligenceService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureBuilderService,
    private readonly consent: ConsentService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>('INTELLIGENCE_CRON') !== 'false';
    if (!enabled) return;
    // Every 6 hours — lightweight stand-in for nightly Redis job.
    this.timer = setInterval(
      () => {
        void this.runForActiveUsers().catch((e) =>
          this.logger.warn(`cron failed: ${String(e)}`),
        );
      },
      6 * 60 * 60 * 1000,
    );
  }

  private requireApproval() {
    return this.config.get<string>('AI_REQUIRE_COACH_APPROVAL') !== 'false';
  }

  async runForActiveUsers() {
    const profiles = await this.prisma.profile.findMany({
      where: { onboardingComplete: true },
      select: { userId: true },
      take: 200,
    });
    let n = 0;
    for (const p of profiles) {
      try {
        await this.runForUser(p.userId);
        n++;
      } catch (e) {
        this.logger.warn(`run ${p.userId}: ${String(e)}`);
      }
    }
    this.logger.log(`Intelligence cron processed ${n} users`);
    return { processed: n };
  }

  async runForUser(userId: string, actorId?: string) {
    const dateKey = new Date().toISOString().slice(0, 10);
    const f = await this.features.build(userId, dateKey);

    const injuryOk = await this.consent.hasGranted(
      userId,
      'injury_risk_insights',
    );
    const predOk = await this.consent.hasGranted(
      userId,
      'predictive_insights',
    );
    const cricketOk = await this.consent.hasGranted(
      userId,
      'cricket_analytics',
    );
    const aiOk = await this.consent.hasGranted(userId, 'ai_coaching');

    // Soft-enable wellness packs when AI coaching already consented (demo ergonomics).
    if (aiOk) {
      if (!injuryOk) {
        await this.prisma.consentRecord.upsert({
          where: {
            userId_purpose: { userId, purpose: 'injury_risk_insights' },
          },
          create: {
            userId,
            purpose: 'injury_risk_insights',
            granted: true,
            grantedAt: new Date(),
          },
          update: { granted: true, grantedAt: new Date(), revokedAt: null },
        });
      }
      if (!predOk) {
        await this.prisma.consentRecord.upsert({
          where: {
            userId_purpose: { userId, purpose: 'predictive_insights' },
          },
          create: {
            userId,
            purpose: 'predictive_insights',
            granted: true,
            grantedAt: new Date(),
          },
          update: { granted: true, grantedAt: new Date(), revokedAt: null },
        });
      }
    }

    const injuryAllowed = injuryOk || aiOk;
    const predAllowed = predOk || aiOk;

    const signals: RuleSignal[] = [];
    if (injuryAllowed) signals.push(...runInjuryRules(f));
    if (cricketOk) signals.push(...runCricketRules(f));
    let predictions = [] as ReturnType<typeof runPredictiveRules>['predictions'];
    if (predAllowed) {
      const pred = runPredictiveRules(f);
      signals.push(...pred.signals);
      predictions = pred.predictions;
    }

    for (const s of signals) {
      await this.prisma.healthSignal.upsert({
        where: {
          userId_dateKey_type: { userId, dateKey, type: s.type },
        },
        create: {
          userId,
          dateKey,
          type: s.type,
          score: s.score,
          band: s.band,
          explainJson: JSON.stringify(s.explain),
          modelVersion: MODEL_VERSION,
        },
        update: {
          score: s.score,
          band: s.band,
          explainJson: JSON.stringify(s.explain),
          modelVersion: MODEL_VERSION,
        },
      });
    }

    for (const p of predictions) {
      await this.prisma.predictionSnapshot.upsert({
        where: {
          userId_dateKey_horizonHours_metric: {
            userId,
            dateKey,
            horizonHours: p.horizonHours,
            metric: p.metric,
          },
        },
        create: {
          userId,
          dateKey,
          horizonHours: p.horizonHours,
          metric: p.metric,
          predictedValue: p.predictedValue,
          confidence: p.confidence,
          driversJson: JSON.stringify(p.drivers),
          modelVersion: MODEL_VERSION,
        },
        update: {
          predictedValue: p.predictedValue,
          confidence: p.confidence,
          driversJson: JSON.stringify(p.drivers),
          modelVersion: MODEL_VERSION,
        },
      });
    }

    const status = this.requireApproval()
      ? AiInsightStatus.DRAFT
      : AiInsightStatus.APPROVED;

    if (aiOk) {
      for (const s of signals) {
        if (!s.insight) continue;
        const existing = await this.prisma.aiInsight.findFirst({
          where: {
            userId,
            category: s.insight.category,
            title: s.insight.title,
            createdAt: { gte: new Date(`${dateKey}T00:00:00.000Z`) },
          },
        });
        if (existing) continue;
        await this.prisma.aiInsight.create({
          data: {
            userId,
            category: s.insight.category,
            title: s.insight.title,
            body: s.insight.body,
            severity: s.insight.severity,
            source: MODEL_VERSION,
            status,
          },
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId ?? userId,
        userId,
        action: 'intelligence.run',
        resource: 'HealthSignal',
        metaJson: JSON.stringify({
          dateKey,
          featureHash: f.featureHash,
          signalTypes: signals.map((s) => s.type),
          predictionMetrics: predictions.map((p) => p.metric),
          modelVersion: MODEL_VERSION,
          consents: {
            injuryOk: injuryAllowed,
            predOk: predAllowed,
            cricketOk,
            aiOk,
          },
          keyMetrics: {
            recoveryDays: f.recovery7.length,
            cricketSessions7: f.cricket7.length,
            sessions7: f.sessions7.length,
          },
        }),
      },
    });

    return this.todayForUserId(userId, dateKey);
  }

  async run(user: AuthUser) {
    return this.runForUser(user.id, user.id);
  }

  async today(user: AuthUser) {
    return this.todayForUserId(user.id);
  }

  private async todayForUserId(
    userId: string,
    dateKey = new Date().toISOString().slice(0, 10),
  ) {
    const [signals, predictions] = await Promise.all([
      this.prisma.healthSignal.findMany({
        where: { userId, dateKey },
      }),
      this.prisma.predictionSnapshot.findMany({
        where: { userId, dateKey },
      }),
    ]);

    return {
      dateKey,
      modelVersion: MODEL_VERSION,
      disclaimer:
        'Wellness guidance only — not medical diagnosis or injury prediction.',
      signals: signals.map((s) => ({
        ...s,
        explain: JSON.parse(s.explainJson || '{}'),
      })),
      predictions: predictions.map((p) => ({
        ...p,
        drivers: JSON.parse(p.driversJson || '{}'),
      })),
    };
  }

  async history(user: AuthUser, from?: string, to?: string) {
    const toKey = to ?? new Date().toISOString().slice(0, 10);
    const fromKey =
      from ??
      new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const signals = await this.prisma.healthSignal.findMany({
      where: { userId: user.id, dateKey: { gte: fromKey, lte: toKey } },
      orderBy: { dateKey: 'asc' },
    });
    return {
      from: fromKey,
      to: toKey,
      signals: signals.map((s) => ({
        ...s,
        explain: JSON.parse(s.explainJson || '{}'),
      })),
    };
  }

  async createOutcome(
    actor: AuthUser,
    body: { userId?: string; dateKey?: string; kind: string; note?: string },
  ) {
    const userId = body.userId ?? actor.id;
    if (userId !== actor.id) {
      if (actor.role !== 'COACH' && actor.role !== 'ADMIN') {
        throw new ForbiddenException();
      }
      const link = await this.prisma.coachClient.findFirst({
        where: { coachId: actor.id, clientId: userId, active: true },
      });
      if (!link && actor.role !== 'ADMIN') throw new ForbiddenException();
    }

    const dateKey = body.dateKey ?? new Date().toISOString().slice(0, 10);
    const row = await this.prisma.outcomeLabel.create({
      data: {
        userId,
        dateKey,
        kind: body.kind,
        note: body.note,
        source: actor.role === 'CLIENT' ? 'athlete' : 'coach',
        actorId: actor.id,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        userId,
        action: 'outcome.label',
        resource: 'OutcomeLabel',
        resourceId: row.id,
        metaJson: JSON.stringify({ kind: body.kind, dateKey }),
      },
    });

    return row;
  }

  listOutcomes(user: AuthUser, clientId?: string) {
    const userId = clientId ?? user.id;
    return this.prisma.outcomeLabel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
