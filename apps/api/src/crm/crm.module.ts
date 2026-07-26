import {
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
    },
    tenant?: string,
  ) {
    const tenantId = await this.tenantId(user, tenant);
    const lead = await this.prisma.crmLead.findFirst({
      where: { id: leadId, tenantId },
    });
    if (!lead) throw new ForbiddenException('Lead is outside this tenant');
    const invoice = await this.prisma.tenantInvoice.create({
      data: {
        tenantId,
        leadId,
        clientId: body.clientId ?? lead.clientUserId,
        packageName: body.packageName,
        amountInr: body.amountInr,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      },
    });
    await this.prisma.crmLead.update({
      where: { id: leadId },
      data: { stage: 'active', packageName: body.packageName },
    });
    return invoice;
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
    },
  ) {
    return this.service.invoice(user, id, body, tenant);
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
