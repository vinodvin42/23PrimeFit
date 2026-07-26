import { Body, Controller, ForbiddenException, Get, Headers, Injectable, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { createHash, randomBytes } from 'crypto';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { TENANT_HEADER } from '../tenants/tenant-context';
import { TenantsService } from '../tenants/tenants.service';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class PartnerService {
  constructor(private readonly prisma: PrismaService, private readonly tenants: TenantsService) {}
  private async staffTenant(user: AuthUser, requested?: string) {
    const context = await this.tenants.resolveActiveTenant(user, requested);
    if (context.role === 'CLIENT') throw new ForbiddenException('Staff access required');
    return context.tenant.id;
  }
  async createKey(user: AuthUser, name: string, tenant?: string) {
    const tenantId = await this.staffTenant(user, tenant);
    const secret = `pf_${randomBytes(24).toString('base64url')}`;
    const apiKey = await this.prisma.apiKey.create({ data: { tenantId, name, keyPrefix: secret.slice(0, 10), secretHash: hash(secret), createdById: user.id } });
    return { id: apiKey.id, name: apiKey.name, key: secret, warning: 'Copy this key now; it cannot be retrieved again.' };
  }
  async registerWebhook(user: AuthUser, body: { url: string; events: string[]; secret?: string }, tenant?: string) {
    const tenantId = await this.staffTenant(user, tenant);
    return this.prisma.webhookEndpoint.create({ data: { tenantId, ...body } });
  }
  async authenticate(key?: string) {
    if (!key) throw new UnauthorizedException('X-API-Key is required');
    const apiKey = await this.prisma.apiKey.findFirst({ where: { secretHash: hash(key), revokedAt: null } });
    if (!apiKey) throw new UnauthorizedException('Invalid API key');
    await this.prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { action: 'partner.api_key.used', resource: 'ApiKey', resourceId: apiKey.id, metaJson: JSON.stringify({ tenantId: apiKey.tenantId, keyPrefix: apiKey.keyPrefix }) } });
    return apiKey;
  }
  async clients(key?: string) {
    const apiKey = await this.authenticate(key);
    return this.prisma.clientMembership.findMany({ where: { tenantId: apiKey.tenantId, status: 'ACTIVE' }, select: { userId: true, joinedAt: true } });
  }
  async usage(key?: string) {
    const apiKey = await this.authenticate(key);
    return this.prisma.usageMeter.findMany({ where: { tenantId: apiKey.tenantId }, orderBy: { updatedAt: 'desc' } });
  }
}

@ApiTags('partner-admin')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('partner')
export class PartnerAdminController {
  constructor(private readonly service: PartnerService) {}
  @Post('keys') key(@CurrentUser() user: AuthUser, @Headers(TENANT_HEADER) tenant: string | undefined, @Body() body: { name: string }) { return this.service.createKey(user, body.name, tenant); }
  @Post('webhooks') webhook(@CurrentUser() user: AuthUser, @Headers(TENANT_HEADER) tenant: string | undefined, @Body() body: { url: string; events: string[]; secret?: string }) { return this.service.registerWebhook(user, body, tenant); }
}
@ApiTags('partner')
@ApiHeader({ name: 'X-API-Key', required: true })
@Controller('partner/v1')
export class PartnerApiController {
  constructor(private readonly service: PartnerService) {}
  @Get('clients') clients(@Headers('x-api-key') key?: string) { return this.service.clients(key); }
  @Get('usage') usage(@Headers('x-api-key') key?: string) { return this.service.usage(key); }
}

import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
@Module({ imports: [TenantsModule], providers: [PartnerService], controllers: [PartnerAdminController, PartnerApiController] })
export class PartnerModule {}
