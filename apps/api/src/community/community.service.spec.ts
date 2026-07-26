import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommunityService } from './community.service';

const tenantCtx = {
  tenant: { id: 'tenant-1' },
  membership: null,
  role: 'CLIENT' as const,
  isPlatformAdmin: false,
};

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('CommunityService', () => {
  it('computes a consecutive-day streak and unlocks the 3-day badge', async () => {
    const prisma = {
      workoutSession: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { completedAt: daysAgo(0) },
            { completedAt: daysAgo(1) },
            { completedAt: daysAgo(2) },
          ]),
      },
      achievement: { create: jest.fn().mockResolvedValue({}) },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    const result = await service.streak({ id: 'user-1' } as never);

    expect(result.streakDays).toBe(3);
    expect(result.newlyUnlocked).toEqual(['STREAK_3']);
    expect(prisma.achievement.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        code: 'STREAK_3',
        title: '3-day workout streak',
        description: undefined,
      },
    });
  });

  it('rejects logging progress before joining a challenge', async () => {
    const prisma = {
      challenge: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'challenge-1',
          tenantId: 'tenant-1',
          targetValue: 5,
        }),
      },
      challengeParticipant: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    await expect(
      service.logProgress({ id: 'user-1' } as never, 'challenge-1', 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('CommunityService friends', () => {
  it('rejects friending yourself', async () => {
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService({} as never, tenants as never);

    await expect(
      service.sendFriendRequest({ id: 'user-1' } as never, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects friending someone outside the active tenant', async () => {
    const prisma = {
      clientMembership: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    await expect(
      service.sendFriendRequest({ id: 'user-1' } as never, 'user-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a duplicate friend request between the same two members', async () => {
    const prisma = {
      clientMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      },
      friendRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-request' }),
      },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    await expect(
      service.sendFriendRequest({ id: 'user-1' } as never, 'user-2'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only lets the recipient respond to a pending request', async () => {
    const prisma = {
      friendRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    await expect(
      service.respondToFriendRequest(
        { id: 'user-1' } as never,
        'request-1',
        true,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects removing a friend connection that does not exist', async () => {
    const prisma = {
      friendRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    await expect(
      service.removeFriend({ id: 'user-1' } as never, 'user-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
