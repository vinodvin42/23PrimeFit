import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MedicationsService } from './medications.service';

describe('MedicationsService', () => {
  it('rejects creating a medication with a blank name', async () => {
    const service = new MedicationsService({} as never);

    await expect(
      service.create({ id: 'user-1' } as never, { name: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects logging a medication that does not belong to the user', async () => {
    const prisma = {
      medication: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new MedicationsService(prisma as never);

    await expect(
      service.logTaken({ id: 'user-1' } as never, 'med-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks a medication taken today idempotently via upsert', async () => {
    const upsert = jest
      .fn<
        Promise<{ id: string }>,
        [{ where: { medicationId_dateKey: { medicationId: string } } }]
      >()
      .mockResolvedValue({ id: 'log-1' });
    const prisma = {
      medication: {
        findFirst: jest.fn().mockResolvedValue({ id: 'med-1' }),
      },
      medicationLog: { upsert },
    };
    const service = new MedicationsService(prisma as never);

    await service.logTaken({ id: 'user-1' } as never, 'med-1');

    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0][0];
    expect(args.where.medicationId_dateKey.medicationId).toBe('med-1');
  });

  it('includes the wellness disclaimer with the medication list', async () => {
    const prisma = {
      medication: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new MedicationsService(prisma as never);

    const result = await service.list({ id: 'user-1' } as never);

    expect(result.disclaimer).toMatch(/not a prescription/);
    expect(result.medications).toEqual([]);
  });
});
