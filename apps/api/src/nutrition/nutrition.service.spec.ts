import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NutritionService } from './nutrition.service';

function makeService(prisma: Record<string, unknown>) {
  return new NutritionService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('NutritionService hydration', () => {
  it('derives the daily target from body weight (33ml/kg)', async () => {
    const prisma = {
      hydrationLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = makeService(prisma);

    const result = await service.hydrationToday({
      id: 'user-1',
      profile: { weightKg: 70 },
    } as never);

    expect(result.targetMl).toBe(2310);
    expect(result.totalMl).toBe(0);
  });

  it('falls back to a default target when weight is unknown', async () => {
    const prisma = {
      hydrationLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = makeService(prisma);

    const result = await service.hydrationToday({
      id: 'user-1',
      profile: null,
    } as never);

    expect(result.targetMl).toBe(2500);
  });

  it('rejects a non-positive hydration amount', async () => {
    const service = makeService({});

    await expect(
      service.logHydration({ id: 'user-1' } as never, 0),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('NutritionService supplements', () => {
  it('marks a supplement taken today idempotently via upsert', async () => {
    const upsert = jest
      .fn<
        Promise<{ id: string }>,
        [{ where: { supplementId_dateKey: { supplementId: string } } }]
      >()
      .mockResolvedValue({ id: 'log-1' });
    const prisma = {
      supplement: {
        findFirst: jest.fn().mockResolvedValue({ id: 'supp-1' }),
      },
      supplementLog: { upsert },
    };
    const service = makeService(prisma);

    await service.logSupplement({ id: 'user-1' } as never, 'supp-1');

    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0][0];
    expect(args.where.supplementId_dateKey.supplementId).toBe('supp-1');
  });

  it('rejects logging a supplement that does not belong to the user', async () => {
    const prisma = {
      supplement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = makeService(prisma);

    await expect(
      service.logSupplement({ id: 'user-1' } as never, 'supp-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects creating a supplement with a blank name', async () => {
    const service = makeService({});

    await expect(
      service.createSupplement({ id: 'user-1' } as never, { name: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
