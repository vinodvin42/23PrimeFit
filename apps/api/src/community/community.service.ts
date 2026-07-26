import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChallengeKind, Prisma, TenantMembershipRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';

type CreateChallengeInput = {
  title: string;
  description?: string;
  kind?: ChallengeKind;
  targetValue?: number;
  startAt: string;
  endAt: string;
};

const STREAK_THRESHOLDS: Array<{ days: number; code: string }> = [
  { days: 3, code: 'STREAK_3' },
  { days: 7, code: 'STREAK_7' },
  { days: 30, code: 'STREAK_30' },
];

const STAFF_ROLES = [
  TenantMembershipRole.OWNER,
  TenantMembershipRole.ADMIN,
  TenantMembershipRole.COACH,
];

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
  ) {}

  async listChallenges(user: AuthUser, tenant?: string) {
    const ctx = await this.tenants.resolveActiveTenant(user, tenant);
    const challenges = await this.prisma.challenge.findMany({
      where: { tenantId: ctx.tenant.id, active: true },
      orderBy: { startAt: 'desc' },
      include: {
        participants: {
          where: { userId: user.id },
          select: { progressValue: true, completedAt: true, joinedAt: true },
        },
        _count: { select: { participants: true } },
      },
    });
    return challenges.map((c) => {
      const { participants, _count, ...rest } = c;
      return {
        ...rest,
        participantCount: _count.participants,
        myProgress: participants[0] ?? null,
      };
    });
  }

  async createChallenge(
    user: AuthUser,
    body: CreateChallengeInput,
    tenant?: string,
  ) {
    const ctx = await this.tenants.resolveActiveTenant(user, tenant);
    this.tenants.assertStaffRole(ctx, STAFF_ROLES);
    return this.prisma.challenge.create({
      data: {
        tenantId: ctx.tenant.id,
        title: body.title,
        description: body.description,
        kind: body.kind ?? ChallengeKind.CUSTOM,
        targetValue: body.targetValue ?? 1,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        createdByUserId: user.id,
      },
    });
  }

  async closeChallenge(user: AuthUser, id: string, tenant?: string) {
    const ctx = await this.tenants.resolveActiveTenant(user, tenant);
    this.tenants.assertStaffRole(ctx, STAFF_ROLES);
    const challenge = await this.prisma.challenge.findFirst({
      where: { id, tenantId: ctx.tenant.id },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    return this.prisma.challenge.update({
      where: { id },
      data: { active: false },
    });
  }

  async join(user: AuthUser, challengeId: string, tenant?: string) {
    const ctx = await this.tenants.resolveActiveTenant(user, tenant);
    const challenge = await this.prisma.challenge.findFirst({
      where: { id: challengeId, tenantId: ctx.tenant.id },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    return this.prisma.challengeParticipant.upsert({
      where: { challengeId_userId: { challengeId, userId: user.id } },
      update: {},
      create: { tenantId: ctx.tenant.id, challengeId, userId: user.id },
    });
  }

  async logProgress(
    user: AuthUser,
    challengeId: string,
    delta: number,
    tenant?: string,
  ) {
    const ctx = await this.tenants.resolveActiveTenant(user, tenant);
    const challenge = await this.prisma.challenge.findFirst({
      where: { id: challengeId, tenantId: ctx.tenant.id },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    const participant = await this.prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId: user.id } },
    });
    if (!participant) {
      throw new ForbiddenException(
        'Join the challenge before logging progress',
      );
    }
    const progressValue = Math.max(0, participant.progressValue + delta);
    const nowCompleted = progressValue >= challenge.targetValue;
    const updated = await this.prisma.challengeParticipant.update({
      where: { id: participant.id },
      data: {
        progressValue,
        completedAt: nowCompleted
          ? (participant.completedAt ?? new Date())
          : null,
      },
    });
    if (nowCompleted && !participant.completedAt) {
      await this.unlockAchievement(
        ctx.tenant.id,
        user.id,
        `CHALLENGE_WIN_${challenge.id}`,
        `Completed "${challenge.title}"`,
      );
    }
    return updated;
  }

  async leaderboard(user: AuthUser, challengeId: string, tenant?: string) {
    const ctx = await this.tenants.resolveActiveTenant(user, tenant);
    const challenge = await this.prisma.challenge.findFirst({
      where: { id: challengeId, tenantId: ctx.tenant.id },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    const participants = await this.prisma.challengeParticipant.findMany({
      where: { challengeId },
      orderBy: [{ progressValue: 'desc' }, { joinedAt: 'asc' }],
      take: 50,
      include: { user: { select: { id: true, displayName: true } } },
    });
    return {
      challenge,
      leaderboard: participants.map((p, i) => ({
        rank: i + 1,
        userId: p.userId,
        displayName: p.user.displayName,
        progressValue: p.progressValue,
        completedAt: p.completedAt,
        isCurrentUser: p.userId === user.id,
      })),
    };
  }

  async achievements(user: AuthUser, tenant?: string) {
    const ctx = await this.tenants.resolveActiveTenant(user, tenant);
    return this.prisma.achievement.findMany({
      where: { tenantId: ctx.tenant.id, userId: user.id },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  async streak(user: AuthUser, tenant?: string) {
    const ctx = await this.tenants.resolveActiveTenant(user, tenant);
    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      select: { completedAt: true },
      orderBy: { completedAt: 'desc' },
      take: 400,
    });
    const days = new Set(
      sessions
        .map((s) => s.completedAt)
        .filter((d): d is Date => d !== null)
        .map((d) => d.toISOString().slice(0, 10)),
    );

    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    if (!days.has(cursor.toISOString().slice(0, 10))) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    let streakDays = 0;
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streakDays += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    const newlyUnlocked: string[] = [];
    for (const { days: threshold, code } of STREAK_THRESHOLDS) {
      if (streakDays < threshold) continue;
      const unlocked = await this.unlockAchievement(
        ctx.tenant.id,
        user.id,
        code,
        `${threshold}-day workout streak`,
      );
      if (unlocked) newlyUnlocked.push(code);
    }

    return { tenantId: ctx.tenant.id, streakDays, newlyUnlocked };
  }

  private async unlockAchievement(
    tenantId: string,
    userId: string,
    code: string,
    title: string,
    description?: string,
  ): Promise<boolean> {
    try {
      await this.prisma.achievement.create({
        data: { tenantId, userId, code, title, description },
      });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return false;
      }
      throw err;
    }
  }
}
