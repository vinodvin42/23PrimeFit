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

describe('NutritionService fasting', () => {
  it('rejects starting a fast while one is already active', async () => {
    const prisma = {
      fastingSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.startFasting({ id: 'user-1' } as never, 16),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('defaults the target to 16 hours when none is given', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'session-1' });
    const prisma = {
      fastingSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    const service = makeService(prisma);

    await service.startFasting({ id: 'user-1' } as never);

    expect(create).toHaveBeenCalledWith({
      data: { userId: 'user-1', targetHours: 16 },
    });
  });

  it('rejects ending a fast when none is active', async () => {
    const prisma = {
      fastingSession: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = makeService(prisma);

    await expect(
      service.endFasting({ id: 'user-1' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('NutritionService shopping list', () => {
  it('generates one item per recipe ingredient, tagged with the recipe source', async () => {
    const createManyAndReturn = jest.fn().mockResolvedValue([]);
    const prisma = {
      recipe: {
        findUnique: jest.fn().mockResolvedValue({
          slug: 'overnight-oats',
          ingredients: ['oats', 'milk', 'chia seeds'],
        }),
      },
      shoppingListItem: { createManyAndReturn },
    };
    const service = makeService(prisma);

    await service.addShoppingListItemsFromRecipe(
      { id: 'user-1' } as never,
      'overnight-oats',
    );

    expect(createManyAndReturn).toHaveBeenCalledWith({
      data: [
        { userId: 'user-1', name: 'oats', source: 'recipe:overnight-oats' },
        { userId: 'user-1', name: 'milk', source: 'recipe:overnight-oats' },
        {
          userId: 'user-1',
          name: 'chia seeds',
          source: 'recipe:overnight-oats',
        },
      ],
    });
  });

  it('rejects adding an item with a blank name', async () => {
    const service = makeService({});

    await expect(
      service.addShoppingListItem({ id: 'user-1' } as never, { name: ' ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects updating an item that does not belong to the user', async () => {
    const prisma = {
      shoppingListItem: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = makeService(prisma);

    await expect(
      service.updateShoppingListItem({ id: 'user-1' } as never, 'item-1', {
        checked: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
