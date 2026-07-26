import { Body, Controller, ForbiddenException, Get, Headers, Injectable, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMembershipStatus } from '@prisma/client';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { TENANT_HEADER } from '../tenants/tenant-context';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService, private readonly tenants: TenantsService) {}
  browse() {
    return this.prisma.marketplaceListing.findMany({ where: { published: true, tenant: { active: true } }, include: { tenant: { select: { id: true, name: true, slug: true } } }, orderBy: { updatedAt: 'desc' } });
  }
  async publish(user: AuthUser, body: { title: string; description: string; category?: string; published?: boolean }, requested?: string) {
    const context = await this.tenants.resolveActiveTenant(user, requested);
    if (context.role === 'CLIENT') throw new ForbiddenException('Staff access required');
    return this.prisma.marketplaceListing.upsert({ where: { tenantId: context.tenant.id }, update: body, create: { tenantId: context.tenant.id, title: body.title, description: body.description, category: body.category, published: body.published ?? false } });
  }
  async enroll(user: AuthUser, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findFirst({ where: { id: listingId, published: true, tenant: { active: true } } });
    if (!listing) throw new ForbiddenException('Listing is unavailable');
    const [enrollment] = await this.prisma.$transaction([
      this.prisma.marketplaceEnrollment.upsert({ where: { tenantId_userId: { tenantId: listing.tenantId, userId: user.id } }, update: {}, create: { tenantId: listing.tenantId, userId: user.id, listingId } }),
      this.prisma.clientMembership.upsert({ where: { tenantId_userId: { tenantId: listing.tenantId, userId: user.id } }, update: { status: ClientMembershipStatus.ACTIVE, joinedAt: new Date() }, create: { tenantId: listing.tenantId, userId: user.id, status: ClientMembershipStatus.ACTIVE, joinedAt: new Date() } }),
    ]);
    return enrollment;
  }
}

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplacePublicController {
  constructor(private readonly service: MarketplaceService) {}
  @Get('listings') browse() { return this.service.browse(); }
}
@ApiTags('marketplace')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly service: MarketplaceService) {}
  @Post('listing') publish(@CurrentUser() user: AuthUser, @Headers(TENANT_HEADER) tenant: string | undefined, @Body() body: { title: string; description: string; category?: string; published?: boolean }) { return this.service.publish(user, body, tenant); }
  @Post('enroll') enroll(@CurrentUser() user: AuthUser, @Body() body: { listingId: string }) { return this.service.enroll(user, body.listingId); }
}

import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
@Module({ imports: [TenantsModule], providers: [MarketplaceService], controllers: [MarketplacePublicController, MarketplaceController] })
export class MarketplaceModule {}
