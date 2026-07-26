import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VitalsService } from './vitals.service';

describe('VitalsService blood pressure', () => {
  it('rejects an out-of-range systolic reading', async () => {
    const service = new VitalsService({} as never);

    await expect(
      service.logBloodPressure({ id: 'user-1' } as never, {
        systolic: 300,
        diastolic: 80,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an out-of-range diastolic reading', async () => {
    const service = new VitalsService({} as never);

    await expect(
      service.logBloodPressure({ id: 'user-1' } as never, {
        systolic: 120,
        diastolic: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a plausible reading and rounds to whole numbers', async () => {
    const create = jest
      .fn<
        Promise<{ id: string }>,
        [{ data: { systolic: number; diastolic: number } }]
      >()
      .mockResolvedValue({ id: 'reading-1' });
    const prisma = { bloodPressureReading: { create } };
    const service = new VitalsService(prisma as never);

    await service.logBloodPressure({ id: 'user-1' } as never, {
      systolic: 120.6,
      diastolic: 79.4,
    });

    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0][0];
    expect(args.data.systolic).toBe(121);
    expect(args.data.diastolic).toBe(79);
  });

  it('rejects removing a reading that does not belong to the user', async () => {
    const prisma = {
      bloodPressureReading: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new VitalsService(prisma as never);

    await expect(
      service.removeBloodPressure({ id: 'user-1' } as never, 'reading-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('VitalsService blood sugar', () => {
  it('rejects an out-of-range value', async () => {
    const service = new VitalsService({} as never);

    await expect(
      service.logBloodSugar({ id: 'user-1' } as never, { valueMgDl: 900 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('includes the trend disclaimer on the list response', async () => {
    const prisma = {
      bloodSugarReading: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new VitalsService(prisma as never);

    const result = await service.listBloodSugar({ id: 'user-1' } as never);

    expect(result.disclaimer).toMatch(/not a diagnosis/);
    expect(result.readings).toEqual([]);
  });
});
