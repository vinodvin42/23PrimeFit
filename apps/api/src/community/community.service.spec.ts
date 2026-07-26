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

function assertStaffRoleLike(
  ctx: { role: string; isPlatformAdmin: boolean },
  allowed: string[],
) {
  if (ctx.isPlatformAdmin) return;
  if (ctx.role === 'CLIENT') {
    throw new ForbiddenException('Staff role required');
  }
  if (ctx.role !== 'PLATFORM_ADMIN' && !allowed.includes(ctx.role)) {
    throw new ForbiddenException('Insufficient tenant role');
  }
}

describe('CommunityService events', () => {
  const staffCtx = { ...tenantCtx, role: 'COACH' as const };

  it('rejects a client creating an event', async () => {
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
      assertStaffRole: jest.fn(assertStaffRoleLike),
    };
    const service = new CommunityService({} as never, tenants as never);

    await expect(
      service.createEvent({ id: 'user-1' } as never, {
        title: 'Group run',
        startAt: '2026-08-01T06:00:00Z',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an event with a blank title', async () => {
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(staffCtx),
      assertStaffRole: jest.fn(assertStaffRoleLike),
    };
    const service = new CommunityService({} as never, tenants as never);

    await expect(
      service.createEvent({ id: 'user-1' } as never, {
        title: '  ',
        startAt: '2026-08-01T06:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an event with an unparseable startAt', async () => {
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(staffCtx),
      assertStaffRole: jest.fn(assertStaffRoleLike),
    };
    const service = new CommunityService({} as never, tenants as never);

    await expect(
      service.createEvent({ id: 'user-1' } as never, {
        title: 'Group run',
        startAt: 'not-a-date',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects RSVPing to an event outside the active tenant', async () => {
    const prisma = {
      communityEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    await expect(
      service.rsvp({ id: 'user-1' } as never, 'event-1', 'GOING'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('upserts an RSVP so re-RSVPing updates rather than duplicates', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'rsvp-1' });
    const prisma = {
      communityEvent: {
        findFirst: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      eventRsvp: { upsert },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    await service.rsvp({ id: 'user-1' } as never, 'event-1', 'MAYBE');

    expect(upsert).toHaveBeenCalledWith({
      where: { eventId_userId: { eventId: 'event-1', userId: 'user-1' } },
      update: { status: 'MAYBE' },
      create: {
        tenantId: 'tenant-1',
        eventId: 'event-1',
        userId: 'user-1',
        status: 'MAYBE',
      },
    });
  });
});

describe('CommunityService transformation stories', () => {
  it('rejects an empty story with no caption and no photos', async () => {
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService({} as never, tenants as never);

    await expect(
      service.createStory({ id: 'user-1' } as never, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a story referencing a photo the caller does not own', async () => {
    const prisma = {
      progressPhoto: { count: jest.fn().mockResolvedValue(0) },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    await expect(
      service.createStory({ id: 'user-1' } as never, {
        beforePhotoId: 'photo-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a caption-only story with no photos', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'story-1' });
    const prisma = { transformationStory: { create } };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    await service.createStory({ id: 'user-1' } as never, {
      caption: '3 months in!',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        caption: '3 months in!',
        beforePhotoId: undefined,
        afterPhotoId: undefined,
      },
    });
  });

  it('rejects removing a story owned by someone else', async () => {
    const prisma = {
      transformationStory: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'story-1', userId: 'user-2' }),
      },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    await expect(
      service.removeStory({ id: 'user-1' } as never, 'story-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('toggles a cheer off when the caller already cheered', async () => {
    const del = jest.fn().mockResolvedValue({});
    const prisma = {
      transformationStory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'story-1' }),
      },
      storyCheer: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cheer-1' }),
        delete: del,
        count: jest.fn().mockResolvedValue(2),
      },
    };
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
    };
    const service = new CommunityService(prisma as never, tenants as never);

    const result = await service.cheerStory(
      { id: 'user-1' } as never,
      'story-1',
    );

    expect(del).toHaveBeenCalledWith({ where: { id: 'cheer-1' } });
    expect(result).toEqual({ cheered: false, cheerCount: 2 });
  });
});
