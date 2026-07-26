import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Injectable,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { TENANT_HEADER } from '../tenants/tenant-context';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
  ) {}

  async analytics(user: AuthUser) {
    if (!user.isPlatformAdmin)
      throw new ForbiddenException('Platform admin required');
    const [subscriptions, usage] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: { plan: true },
      }),
      this.prisma.usageMeter.groupBy({
        by: ['metric'],
        _sum: { used: true },
        _count: true,
      }),
    ]);
    return {
      activeTenants: new Set(subscriptions.map((s) => s.tenantId)).size,
      mrrInr: subscriptions.reduce(
        (total, s) => total + s.plan.priceInrMonthly,
        0,
      ),
      usage,
    };
  }

  private async tenantId(user: AuthUser, requested?: string) {
    const context = await this.tenants.resolveActiveTenant(user, requested);
    if (context.role === 'CLIENT')
      throw new ForbiddenException('Staff access required');
    return context.tenant.id;
  }
  async uploadKnowledge(
    user: AuthUser,
    body: { title: string; content: string; sourceUrl?: string },
    tenant?: string,
  ) {
    const tenantId = await this.tenantId(user, tenant);
    return this.prisma.tenantKnowledgeDoc.create({
      data: {
        tenantId,
        title: body.title,
        content: body.content,
        sourceUrl: body.sourceUrl,
        createdById: user.id,
      },
    });
  }
  async answer(user: AuthUser, question: string, tenant?: string) {
    const tenantId = await this.tenantId(user, tenant);
    const terms = question
      .toLowerCase()
      .split(/\W+/)
      .filter((term) => term.length > 2);
    const docs = await this.prisma.tenantKnowledgeDoc.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    const ranked = docs
      .map((doc) => ({
        doc,
        score: terms.reduce(
          (score, term) =>
            score +
            (doc.content.toLowerCase().includes(term) ||
            doc.title.toLowerCase().includes(term)
              ? 1
              : 0),
          0,
        ),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best)
      return {
        answer: 'No matching tenant knowledge was found.',
        citations: [],
      };
    const excerpt = best.doc.content.slice(0, 600);
    return {
      answer: excerpt,
      citations: [
        {
          id: best.doc.id,
          title: best.doc.title,
          sourceUrl: best.doc.sourceUrl,
        },
      ],
    };
  }
}

@ApiTags('platform', 'knowledge')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller()
export class PlatformController {
  constructor(private readonly service: PlatformService) {}
  @Get('platform/analytics') analytics(@CurrentUser() user: AuthUser) {
    return this.service.analytics(user);
  }
  @Post('knowledge') upload(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Body() body: { title: string; content: string; sourceUrl?: string },
  ) {
    return this.service.uploadKnowledge(user, body, tenant);
  }
  @Get('knowledge/answer') answer(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenant: string | undefined,
    @Query('q') question: string,
  ) {
    return this.service.answer(user, question ?? '', tenant);
  }
}

import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
@Module({
  imports: [TenantsModule],
  providers: [PlatformService],
  controllers: [PlatformController],
})
export class PlatformModule {}
