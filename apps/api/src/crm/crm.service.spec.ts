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
