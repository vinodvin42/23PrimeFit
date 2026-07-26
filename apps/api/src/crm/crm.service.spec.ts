import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CrmService } from './crm.module';

const tenantCtx = {
  tenant: { id: 'tenant-1' },
  membership: null,
  role: 'OWNER' as const,
  isPlatformAdmin: false,
};

function makeService(prisma: Record<string, unknown>) {
  const tenants = {
    resolveActiveTenant: jest.fn().mockResolvedValue(tenantCtx),
  };
  return new CrmService(prisma as never, tenants as never);
}

describe('CrmService coupons', () => {
  it('rejects creating a coupon with a blank code', async () => {
    const service = makeService({});

    await expect(
      service.createCoupon({ id: 'user-1' } as never, {
        code: '  ',
        discountValue: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects creating a coupon with a non-positive discount value', async () => {
    const service = makeService({});

    await expect(
      service.createCoupon({ id: 'user-1' } as never, {
        code: 'SAVE10',
        discountValue: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invoice with an unknown coupon code', async () => {
    const prisma = {
      crmLead: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'lead-1', clientUserId: 'client-1' }),
      },
      tenantCoupon: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = makeService(prisma);

    await expect(
      service.invoice({ id: 'user-1' } as never, 'lead-1', {
        packageName: 'Coaching',
        amountInr: 5000,
        couponCode: 'NOPE',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies a percent discount and increments redemption count', async () => {
    const invoiceCreate = jest
      .fn<Promise<{ id: string }>, [{ data: { amountInr: number } }]>()
      .mockResolvedValue({ id: 'invoice-1' });
    const couponUpdate = jest.fn().mockResolvedValue({});
    const leadUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      crmLead: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'lead-1', clientUserId: 'client-1' }),
        update: leadUpdate,
      },
      tenantCoupon: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'coupon-1',
          active: true,
          expiresAt: null,
          maxRedemptions: null,
          redemptionCount: 0,
          discountType: 'PERCENT',
          discountValue: 20,
        }),
        update: couponUpdate,
      },
      tenantInvoice: { create: invoiceCreate },
    };
    const service = makeService(prisma);

    await service.invoice({ id: 'user-1' } as never, 'lead-1', {
      packageName: 'Coaching',
      amountInr: 5000,
      couponCode: 'save20',
    });

    expect(invoiceCreate).toHaveBeenCalledTimes(1);
    expect(invoiceCreate.mock.calls[0][0].data.amountInr).toBe(4000);
    expect(couponUpdate).toHaveBeenCalledWith({
      where: { id: 'coupon-1' },
      data: { redemptionCount: { increment: 1 } },
    });
  });

  it('rejects staff-only actions for a client role', async () => {
    const tenants = {
      resolveActiveTenant: jest.fn().mockResolvedValue({
        ...tenantCtx,
        role: 'CLIENT',
      }),
    };
    const service = new CrmService({} as never, tenants as never);

    await expect(
      service.listCoupons({ id: 'user-1' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('CrmService membership plans', () => {
  it('rejects a plan with a blank name', async () => {
    const service = makeService({});

    await expect(
      service.createMembershipPlan({ id: 'user-1' } as never, {
        name: '  ',
        priceInr: 5000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a plan with a non-positive price', async () => {
    const service = makeService({});

    await expect(
      service.createMembershipPlan({ id: 'user-1' } as never, {
        name: '12-session pack',
        priceInr: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enrolling a lead seeds sessionsRemaining from the plan', async () => {
    const create = jest
      .fn<
        Promise<{ id: string }>,
        [{ data: { sessionsRemaining?: number | null } }]
      >()
      .mockResolvedValue({ id: 'enrollment-1' });
    const prisma = {
      crmLead: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'lead-1', clientUserId: 'client-1' }),
      },
      membershipPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'plan-1',
          sessionCount: 12,
          durationDays: null,
        }),
      },
      membershipEnrollment: { create },
    };
    const service = makeService(prisma);

    await service.enrollLead({ id: 'user-1' } as never, 'lead-1', {
      planId: 'plan-1',
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data.sessionsRemaining).toBe(12);
  });

  it('rejects enrolling a lead with no linked client and no clientId given', async () => {
    const prisma = {
      crmLead: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'lead-1', clientUserId: null }),
      },
      membershipPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plan-1' }),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.enrollLead({ id: 'user-1' } as never, 'lead-1', {
        planId: 'plan-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks an enrollment EXPIRED once the last session is consumed', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      membershipEnrollment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enrollment-1',
          status: 'ACTIVE',
          sessionsRemaining: 1,
        }),
        update,
      },
    };
    const service = makeService(prisma);

    await service.consumeSession({ id: 'user-1' } as never, 'enrollment-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: { sessionsRemaining: 0, status: 'EXPIRED' },
    });
  });

  it('rejects consuming a session with none remaining', async () => {
    const prisma = {
      membershipEnrollment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enrollment-1',
          status: 'ACTIVE',
          sessionsRemaining: 0,
        }),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.consumeSession({ id: 'user-1' } as never, 'enrollment-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
