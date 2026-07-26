import { BadRequestException } from '@nestjs/common';
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
