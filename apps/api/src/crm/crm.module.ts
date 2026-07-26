import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { TenantCouponDiscountType } from '@prisma/client';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { TENANT_HEADER } from '../tenants/tenant-context';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantsService } from '../tenants/tenants.service';
import { Module } from '@nestjs/common';

type LeadInput = {
  name: string;
  email?: string;
  phone?: string;
  packageName?: string;
  notes?: string;
};

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
  ) {}

  private async tenantId(user: AuthUser, requested?: string) {
    const context = await this.tenants.resolveActiveTenant(user, requested);
    if (context.role === 'CLIENT') {
      throw new ForbiddenException('Staff access required');
    }
    return context.tenant.id;
  }

  async list(user: AuthUser, tenant?: string) {
    const tenantId = await this.tenantId(user, tenant);
    return this.prisma.crmLead.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(user: AuthUser, id: string, tenant?: string) {
    const tenantId = await this.tenantId(user, tenant);
    const lead = await this.prisma.crmLead.findFirst({
      where: { id, tenantId },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    const [invoices, contracts] = await Promise.all([
      this.prisma.tenantInvoice.findMany({
        where: { tenantId, leadId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.clientContract.findMany({
        where: { tenantId, leadId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { ...lead, invoices, contracts };
  }

  async create(user: AuthUser, input: LeadInput, tenant?: string) {
    const tenantId = await this.tenantId(user, tenant);
    return this.prisma.crmLead.create({ data: { tenantId, ...input } });
  }

  async update(
    user: AuthUser,
    id: string,
    body: Partial<LeadInput & { stage: string }>,
    tenant?: string,
  ) {
    const tenantId = await this.tenantId(user, tenant);
    const lead = await this.prisma.crmLead.findFirst({
      where: { id, tenantId },
    });
    if (!lead) throw new ForbiddenException('Lead is outside this tenant');
    return this.prisma.crmLead.update({ where: { id }, data: body });
  }

  async invoice(
    user: AuthUser,
    leadId: string,
    body: {
      packageName: string;
      amountInr: number;
      clientId?: string;
      dueAt?: string;
      couponCode?: string;
    },
    tenant?: string,
  ) {
    const tenantId = await this.tenantId(user, tenant);
    const lead = await this.prisma.crmLead.findFirst({
      where: { id: leadId, tenantId },
    });
    if (!lead) throw new ForbiddenException('Lead is outside this tenant');

    let amountInr = body.amountInr;
    let coupon: { id: string } | null = null;
    if (body.couponCode?.trim()) {
      const found = await this.prisma.tenantCoupon.findUnique({
        where: { tenantId_code: { tenantId, code: body.couponCode.trim() } },
      });
      if (
        !found ||
        !found.active ||
        (found.expiresAt && found.expiresAt < new Date()) ||
        (found.maxRedemptions !== null &&
          found.redemptionCount >= found.maxRedemptions)
      ) {
        throw new BadRequestException('Coupon is invalid or expired');
      }
      coupon = found;
      amountInr =
        found.discountType === 'PERCENT'
          ? Math.round(amountInr * (1 - found.discountValue / 100))
          : Math.max(0, Math.round(amountInr - found.discountValue));
    }

    const invoice = await this.prisma.tenantInvoice.create({
      data: {
        tenantId,
        leadId,
        clientId: body.clientId ?? lead.clientUserId,
        packageName: body.packageName,
        amountInr,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      },
    });
    if (coupon) {
      await this.prisma.tenantCoupon.update({
        where: { id: coupon.id },
        data: { redemptionCount: { increment: 1 } },
      });
    }
    await this.prisma.crmLead.update({
      where: { id: leadId },
      data: { stage: 'active', packageName: body.packageName },
    });
    return invoice;
  }

  async listCoupons(user: AuthUser, tenant?: string) {
    const tenantId = await this.tenantId(user, tenant);
    return this.prisma.tenantCoupon.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCoupon(
    user: AuthUser,
    body: {
      code: string;
      discountType?: TenantCouponDiscountType;
      discountValue: number;
      maxRedemptions?: number;
      expiresAt?: string;
    },
    tenant?: string,
  ) {
    const tenantId = await this.tenantId(user, tenant);
    if (!body.code?.trim()) {
      throw new BadRequestException('code is required');
    }
    if (!Number.isFinite(body.discountValue) || body.discountValue <= 0) {
      throw new BadRequestException('discountValue must be a positive number');
    }
    return this.prisma.tenantCoupon.create({
      data: {
        tenantId,
        code: body.code.trim().toUpperCase(),
        discountType: body.discountType ?? 'PERCENT',
        discountValue: body.discountValue,
        maxRedemptions: body.maxRedemptions,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    });
  }

  async deactivateCoupon(user: AuthUser, id: string, tenant?: string) {
    const tenantId = await this.tenantId(user, tenant);
    const coupon = await this.prisma.tenantCoupon.findFirst({
      where: { id, tenantId },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return this.prisma.tenantCoupon.update({
      where: { id },
      data: { active: false },
    });
  }

  async createContract(
    user: AuthUser,
    leadId: string,
    body: { title: string; kind?: string; body?: string },
    tenant?: string,
  ) {
    const tenantId = await this.tenantId(user, tenant);
    const lead = await this.prisma.crmLead.findFirst({
      where: { id: leadId, tenantId },
    });
    if (!lead) throw new ForbiddenException('Lead is outside this tenant');
    return this.prisma.clientContract.create({
      data: {
        tenantId,
        leadId,
        clientId: lead.clientUserId,
        title: body.title || 'Coaching agreement',
        kind: body.kind || 'waiver',
        body:
          body.body ||
          `Agreement for ${lead.name}. Client acknowledges coaching is wellness guidance, not medical care.`,
      },
    });
  }

  async markInvoicePaid(user: AuthUser, invoiceId: string, tenant?: string) {
    const tenantId = await this.tenantId(user, tenant);
    const invoice = await this.prisma.tenantInvoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.prisma.tenantInvoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }
}

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly service: CrmService) {}

  @Get('leads')
  leads(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant?: string,
  ) {
    return this.service.list(user, tenant);
  }

  @Get('leads/:id')
  get(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.service.get(user, id, tenant);
  }

  @Post('leads')
  create(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Body() body: LeadInput,
  ) {
    return this.service.create(user, body, tenant);
  }

  @Patch('leads/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
    @Body() body: Partial<LeadInput & { stage: string }>,
  ) {
    return this.service.update(user, id, body, tenant);
  }

  @Post('leads/:id/invoices')
  invoice(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
    @Body()
    body: {
      packageName: string;
      amountInr: number;
      clientId?: string;
      dueAt?: string;
      couponCode?: string;
    },
  ) {
    return this.service.invoice(user, id, body, tenant);
  }

  @Get('coupons')
  listCoupons(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant?: string,
  ) {
    return this.service.listCoupons(user, tenant);
  }

  @Post('coupons')
  createCoupon(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Body()
    body: {
      code: string;
      discountType?: TenantCouponDiscountType;
      discountValue: number;
      maxRedemptions?: number;
      expiresAt?: string;
    },
  ) {
    return this.service.createCoupon(user, body, tenant);
  }

  @Patch('coupons/:id/deactivate')
  deactivateCoupon(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.service.deactivateCoupon(user, id, tenant);
  }

  @Post('leads/:id/contracts')
  contract(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
    @Body() body: { title: string; kind?: string; body?: string },
  ) {
    return this.service.createContract(user, id, body, tenant);
  }

  @Post('invoices/:id/paid')
  markPaid(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Param('id') id: string,
  ) {
    return this.service.markInvoicePaid(user, id, tenant);
  }
}

@Module({
  imports: [TenantsModule],
  providers: [CrmService],
  controllers: [CrmController],
})
export class CrmModule {}
