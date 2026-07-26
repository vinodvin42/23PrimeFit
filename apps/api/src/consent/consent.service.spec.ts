import { ForbiddenException } from '@nestjs/common';
import { ConsentService } from './consent.service';

describe('ConsentService', () => {
  it('denies a sensitive feature when consent is absent', async () => {
    const prisma = {
      consentRecord: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new ConsentService(prisma as never);

    await expect(
      service.requireGranted('user-1', 'female_health_tracking'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
