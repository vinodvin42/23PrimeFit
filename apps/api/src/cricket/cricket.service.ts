import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CricketRole,
  CricketSessionKind,
  CricketTeamLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { ConsentService } from '../consent/consent.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { computeLoads } from '../intelligence/rule-packs';
import { FeatureBuilderService } from '../intelligence/feature-builder.service';

@Injectable()
export class CricketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
    private readonly intelligence: IntelligenceService,
    private readonly features: FeatureBuilderService,
  ) {}

  async getProfile(user: AuthUser) {
    const profile = await this.prisma.cricketAthleteProfile.findUnique({
      where: { userId: user.id },
    });
    return (
      profile ?? {
        userId: user.id,
        primaryRole: 'ALL_ROUNDER',
        bowlingType: null,
        battingHand: null,
        teamLevel: 'CLUB',
      }
    );
  }

  async upsertProfile(
    user: AuthUser,
    body: {
      primaryRole?: CricketRole;
      bowlingType?: string;
      battingHand?: string;
      teamLevel?: CricketTeamLevel;
    },
  ) {
    return this.prisma.cricketAthleteProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        primaryRole: body.primaryRole ?? CricketRole.ALL_ROUNDER,
        bowlingType: body.bowlingType,
        battingHand: body.battingHand,
        teamLevel: body.teamLevel ?? CricketTeamLevel.CLUB,
      },
      update: {
        primaryRole: body.primaryRole,
        bowlingType: body.bowlingType,
        battingHand: body.battingHand,
        teamLevel: body.teamLevel,
      },
    });
  }

  listSessions(user: AuthUser) {
    return this.prisma.cricketSession.findMany({
      where: { userId: user.id },
      orderBy: [{ dateKey: 'desc' }, { createdAt: 'desc' }],
      take: 60,
    });
  }

  async createSession(
    user: AuthUser,
    body: {
      dateKey?: string;
      kind?: CricketSessionKind;
      durationMin?: number;
      rpe?: number;
      notes?: string;
      overs?: number;
      balls?: number;
      bowlIntensity?: string;
      batMinutes?: number;
      fieldMinutes?: number;
      runs?: number;
      ballsFaced?: number;
      wickets?: number;
      economy?: number;
      workoutSessionId?: string;
    },
  ) {
    const dateKey = body.dateKey ?? new Date().toISOString().slice(0, 10);
    const session = await this.prisma.cricketSession.create({
      data: {
        userId: user.id,
        dateKey,
        kind: body.kind ?? CricketSessionKind.NETS,
        durationMin: body.durationMin ?? 60,
        rpe: body.rpe,
        notes: body.notes,
        overs: body.overs,
        balls: body.balls,
        bowlIntensity: body.bowlIntensity,
        batMinutes: body.batMinutes,
        fieldMinutes: body.fieldMinutes,
        runs: body.runs,
        ballsFaced: body.ballsFaced,
        wickets: body.wickets,
        economy: body.economy,
        workoutSessionId: body.workoutSessionId,
      },
    });

    // Auto-grant cricket consent on first log for smoother demos; still auditable.
    const has = await this.consent.hasGranted(user.id, 'cricket_analytics');
    if (!has) {
      await this.consent.upsert(user, 'cricket_analytics', true);
    }

    try {
      await this.intelligence.runForUser(user.id, user.id);
    } catch {
      /* non-blocking */
    }

    return session;
  }

  async load(user: AuthUser) {
    const f = await this.features.build(user.id);
    const { acuteBowl, chronicBowl, acwr } = computeLoads(f);
    const overs7 = f.cricket7.reduce((a, c) => a + (c.overs ?? 0), 0);
    const overs28 = f.cricket28.reduce((a, c) => a + (c.overs ?? 0), 0);
    return {
      overs7,
      overs28,
      sessionCount7: f.cricket7.length,
      sessionCount28: f.cricket28.length,
      bowlLoadAcute: acuteBowl,
      bowlLoadChronic: chronicBowl,
      acwr: Number(acwr.toFixed(3)),
      role: f.cricketRole,
    };
  }

  async dashboard(user: AuthUser) {
    const [profile, load, signals, sessions] = await Promise.all([
      this.getProfile(user),
      this.load(user),
      this.prisma.healthSignal.findMany({
        where: {
          userId: user.id,
          dateKey: new Date().toISOString().slice(0, 10),
          type: { startsWith: 'CRICKET_' },
        },
      }),
      this.listSessions(user),
    ]);

    return {
      profile,
      load,
      signals: signals.map((s) => ({
        ...s,
        explain: JSON.parse(s.explainJson || '{}') as Record<string, unknown>,
      })),
      recentSessions: sessions.slice(0, 8),
      disclaimer:
        'Cricket load analytics are wellness guidance, not selection science.',
    };
  }

  async getSession(user: AuthUser, id: string) {
    const row = await this.prisma.cricketSession.findFirst({
      where: { id, userId: user.id },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
}
