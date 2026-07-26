import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientMembershipStatus,
  Role,
  SubscriptionStatus,
  TenantMembershipRole,
  TenantType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import type { ActiveTenantContext } from './tenant-context';

export const INTERNAL_TENANT_SLUG = 'primefit-internal';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureInternalTenant() {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: INTERNAL_TENANT_SLUG },
    });
    if (existing) return existing;

    const trialPlan = await this.ensureStarterPlan();
    const tenant = await this.prisma.tenant.create({
      data: {
        slug: INTERNAL_TENANT_SLUG,
        name: '23PrimeFit Internal',
        type: TenantType.PRIMEFIT_INTERNAL,
        active: true,
      },
    });

    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 10);
    await this.prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: trialPlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
      },
    });

    return tenant;
  }

  async ensureStarterPlan() {
    return this.prisma.plan.upsert({
      where: { code: 'starter' },
      update: { active: true },
      create: {
        code: 'starter',
        name: 'Starter',
        description: 'Trial-friendly plan for independent coaches',
        priceInrMonthly: 1999,
        clientSeatLimit: 25,
        aiInsightLimit: 200,
        storageMbLimit: 2048,
      },
    });
  }

  async ensureProPlan() {
    return this.prisma.plan.upsert({
      where: { code: 'pro' },
      update: { active: true },
      create: {
        code: 'pro',
        name: 'Pro',
        description: 'Growing coaching businesses',
        priceInrMonthly: 4999,
        clientSeatLimit: 100,
        aiInsightLimit: 1000,
        storageMbLimit: 10240,
      },
    });
  }

  async listMembershipsForUser(user: AuthUser) {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId: user.id, active: true },
      include: {
        tenant: {
          include: {
            subscriptions: {
              where: {
                status: {
                  in: [
                    SubscriptionStatus.TRIALING,
                    SubscriptionStatus.ACTIVE,
                  ],
                },
              },
              include: { plan: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (user.role === Role.CLIENT) {
      const clientMemberships = await this.prisma.clientMembership.findMany({
        where: {
          userId: user.id,
          status: {
            in: [
              ClientMembershipStatus.ACTIVE,
              ClientMembershipStatus.INVITED,
            ],
          },
        },
        include: { tenant: true },
      });
      return {
        staff: memberships,
        client: clientMemberships,
      };
    }

    return { staff: memberships, client: [] };
  }

  async resolveActiveTenant(
    user: AuthUser,
    requestedTenantId?: string | null,
  ): Promise<ActiveTenantContext> {
    if (user.isPlatformAdmin && requestedTenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: requestedTenantId },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');
      return {
        tenant,
        membership: null,
        role: 'PLATFORM_ADMIN',
        isPlatformAdmin: true,
      };
    }

    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId: user.id, active: true },
      include: { tenant: true },
    });

    if (user.role === Role.CLIENT) {
      const clientMemberships = await this.prisma.clientMembership.findMany({
        where: {
          userId: user.id,
          status: {
            in: [
              ClientMembershipStatus.ACTIVE,
              ClientMembershipStatus.INVITED,
            ],
          },
        },
        include: { tenant: true },
      });
      const pick =
        (requestedTenantId &&
          clientMemberships.find((m) => m.tenantId === requestedTenantId)) ||
        clientMemberships.find(
          (m) => m.status === ClientMembershipStatus.ACTIVE,
        ) ||
        clientMemberships[0];
      if (!pick) {
        const internal = await this.ensureInternalTenant();
        return {
          tenant: internal,
          membership: null,
          role: 'CLIENT',
          isPlatformAdmin: false,
        };
      }
      return {
        tenant: pick.tenant,
        membership: null,
        role: 'CLIENT',
        isPlatformAdmin: false,
      };
    }

    if (!memberships.length) {
      const internal = await this.ensureInternalTenant();
      if (user.role === Role.COACH || user.role === Role.ADMIN) {
        const membership = await this.prisma.tenantMembership.upsert({
          where: {
            tenantId_userId: { tenantId: internal.id, userId: user.id },
          },
          update: { active: true, role: TenantMembershipRole.COACH },
          create: {
            tenantId: internal.id,
            userId: user.id,
            role:
              user.role === Role.ADMIN
                ? TenantMembershipRole.ADMIN
                : TenantMembershipRole.COACH,
          },
          include: { tenant: true },
        });
        return {
          tenant: membership.tenant,
          membership,
          role: membership.role,
          isPlatformAdmin: false,
        };
      }
      throw new ForbiddenException('No tenant membership');
    }

    const selected =
      (requestedTenantId &&
        memberships.find((m) => m.tenantId === requestedTenantId)) ||
      memberships[0];

    if (!selected) {
      throw new ForbiddenException('Not a member of the requested tenant');
    }

    return {
      tenant: selected.tenant,
      membership: selected,
      role: selected.role,
      isPlatformAdmin: false,
    };
  }

  async registerCoachWorkspace(
    user: AuthUser,
    body: { name: string; slug?: string },
  ) {
    if (user.role !== Role.COACH && user.role !== Role.ADMIN) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: Role.COACH },
      });
    }

    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Workspace name is required');

    const slug =
      body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    if (!slug) throw new BadRequestException('Valid slug required');

    const clash = await this.prisma.tenant.findUnique({ where: { slug } });
    if (clash) throw new BadRequestException('Workspace slug already taken');

    const plan = await this.ensureStarterPlan();
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);
    const periodEnd = new Date(trialEnds);

    const tenant = await this.prisma.tenant.create({
      data: {
        slug,
        name,
        type: TenantType.EXTERNAL_COACH_BUSINESS,
        ownerUserId: user.id,
        trialEndsAt: trialEnds,
        memberships: {
          create: {
            userId: user.id,
            role: TenantMembershipRole.OWNER,
          },
        },
        subscriptions: {
          create: {
            planId: plan.id,
            status: SubscriptionStatus.TRIALING,
            currentPeriodEnd: periodEnd,
            events: {
              create: {
                type: 'trial.started',
                metaJson: JSON.stringify({ days: 14 }),
              },
            },
          },
        },
        entitlements: {
          create: [
            { key: 'client_seats', valueInt: plan.clientSeatLimit },
            { key: 'ai_insights', valueInt: plan.aiInsightLimit },
            { key: 'storage_mb', valueInt: plan.storageMbLimit },
          ],
        },
      },
      include: {
        subscriptions: { include: { plan: true } },
        memberships: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        userId: user.id,
        action: 'tenant.created',
        resource: 'Tenant',
        resourceId: tenant.id,
        metaJson: JSON.stringify({ slug, trialEndsAt: trialEnds }),
      },
    });

    return tenant;
  }

  async activateSubscriptionDemo(user: AuthUser, tenantId: string) {
    const ctx = await this.resolveActiveTenant(user, tenantId);
    this.assertStaffRole(ctx, [
      TenantMembershipRole.OWNER,
      TenantMembershipRole.ADMIN,
    ]);

    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        razorpaySubscriptionId:
          sub.razorpaySubscriptionId ?? `demo_sub_${tenantId.slice(0, 8)}`,
        events: {
          create: {
            type: 'subscription.activated',
            metaJson: JSON.stringify({ mode: 'demo_or_razorpay' }),
          },
        },
      },
      include: { plan: true },
    });

    return updated;
  }

  async inviteClient(
    user: AuthUser,
    tenantId: string,
    body: { email: string },
  ) {
    const ctx = await this.resolveActiveTenant(user, tenantId);
    this.assertStaffRole(ctx, [
      TenantMembershipRole.OWNER,
      TenantMembershipRole.ADMIN,
      TenantMembershipRole.COACH,
    ]);

    await this.assertClientSeatAvailable(tenantId);

    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Valid email required');
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const invite = await this.prisma.clientInvitation.create({
      data: {
        tenantId,
        email,
        token,
        invitedById: user.id,
        expiresAt,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'tenant.client_invited',
        resource: 'ClientInvitation',
        resourceId: invite.id,
        metaJson: JSON.stringify({ email, tenantId }),
      },
    });

    return {
      id: invite.id,
      email: invite.email,
      token: invite.token,
      expiresAt: invite.expiresAt,
      acceptPath: `/api/tenants/invitations/${invite.token}/accept`,
    };
  }

  async acceptInvitation(user: AuthUser, token: string) {
    const invite = await this.prisma.clientInvitation.findUnique({
      where: { token },
      include: { tenant: true },
    });
    if (!invite) throw new NotFoundException('Invitation not found');
    if (invite.acceptedAt) {
      throw new BadRequestException('Invitation already accepted');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invitation expired');
    }

    if (
      user.email &&
      invite.email.toLowerCase() !== user.email.toLowerCase() &&
      !user.email.endsWith('@dev.local')
    ) {
      throw new ForbiddenException('Invitation email mismatch');
    }

    await this.assertClientSeatAvailable(invite.tenantId);

    const membership = await this.prisma.clientMembership.upsert({
      where: {
        tenantId_userId: { tenantId: invite.tenantId, userId: user.id },
      },
      update: {
        status: ClientMembershipStatus.ACTIVE,
        joinedAt: new Date(),
      },
      create: {
        tenantId: invite.tenantId,
        userId: user.id,
        status: ClientMembershipStatus.ACTIVE,
        invitedBy: invite.invitedById,
        joinedAt: new Date(),
      },
    });

    await this.prisma.coachClient.upsert({
      where: {
        tenantId_coachId_clientId: {
          tenantId: invite.tenantId,
          coachId: invite.invitedById,
          clientId: user.id,
        },
      },
      update: { active: true },
      create: {
        tenantId: invite.tenantId,
        coachId: invite.invitedById,
        clientId: user.id,
        notes: 'Accepted workspace invitation',
      },
    });

    await this.prisma.clientInvitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    await this.incrementUsage(invite.tenantId, 'client_seats', 1);

    return {
      tenant: invite.tenant,
      membership,
    };
  }

  async usageSummary(user: AuthUser, tenantId: string) {
    const ctx = await this.resolveActiveTenant(user, tenantId);
    this.assertStaffRole(ctx, [
      TenantMembershipRole.OWNER,
      TenantMembershipRole.ADMIN,
      TenantMembershipRole.COACH,
      TenantMembershipRole.ANALYST,
    ]);

    const plan = await this.activePlan(tenantId);
    const periodKey = new Date().toISOString().slice(0, 7);
    const meters = await this.prisma.usageMeter.findMany({
      where: { tenantId, periodKey },
    });
    const clients = await this.prisma.clientMembership.count({
      where: {
        tenantId,
        status: ClientMembershipStatus.ACTIVE,
      },
    });

    const team = await this.prisma.tenantMembership.findMany({
      where: { tenantId, active: true },
      include: {
        user: {
          select: { id: true, displayName: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const invitations = await this.prisma.clientInvitation.findMany({
      where: { tenantId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      tenantId,
      periodKey,
      plan,
      seats: {
        used: clients,
        limit: plan?.clientSeatLimit ?? 25,
      },
      meters,
      team,
      invitations,
    };
  }

  async listTenantsPlatformAdmin(user: AuthUser) {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin required');
    }
    return this.prisma.tenant.findMany({
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { memberships: true, clientMemberships: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPlans() {
    await this.ensureStarterPlan();
    await this.ensureProPlan();
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { priceInrMonthly: 'asc' },
    });
  }

  async assertCanAccessTenantResource(
    ctx: ActiveTenantContext,
    resourceTenantId: string | null | undefined,
  ) {
    if (!resourceTenantId) return;
    if (ctx.isPlatformAdmin) return;
    if (resourceTenantId !== ctx.tenant.id) {
      throw new ForbiddenException('Cross-tenant access denied');
    }
  }

  async getResourceOrDeny<T extends { tenantId?: string | null; id: string }>(
    ctx: ActiveTenantContext,
    resource: T | null,
    label = 'Resource',
  ): Promise<T> {
    if (!resource) throw new NotFoundException(`${label} not found`);
    await this.assertCanAccessTenantResource(ctx, resource.tenantId);
    return resource;
  }

  assertStaffRole(
    ctx: ActiveTenantContext,
    allowed: TenantMembershipRole[],
  ) {
    if (ctx.isPlatformAdmin) return;
    if (ctx.role === 'CLIENT') {
      throw new ForbiddenException('Staff role required');
    }
    if (
      ctx.role !== 'PLATFORM_ADMIN' &&
      !allowed.includes(ctx.role as TenantMembershipRole)
    ) {
      throw new ForbiddenException('Insufficient tenant role');
    }
  }

  private async activePlan(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE],
        },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return sub?.plan ?? null;
  }

  private async assertClientSeatAvailable(tenantId: string) {
    const plan = await this.activePlan(tenantId);
    const limit = plan?.clientSeatLimit ?? 25;
    const used = await this.prisma.clientMembership.count({
      where: {
        tenantId,
        status: ClientMembershipStatus.ACTIVE,
      },
    });
    if (used >= limit) {
      throw new ForbiddenException('Client seat limit reached for this plan');
    }
  }

  async incrementUsage(tenantId: string, metric: string, by = 1) {
    const periodKey = new Date().toISOString().slice(0, 7);
    await this.prisma.usageMeter.upsert({
      where: {
        tenantId_periodKey_metric: { tenantId, periodKey, metric },
      },
      update: { used: { increment: by } },
      create: { tenantId, periodKey, metric, used: by },
    });
  }

  /** Backfill existing coach/client rows into the internal tenant. */
  async migrateLegacyToInternal() {
    const tenant = await this.ensureInternalTenant();

    const links = await this.prisma.coachClient.findMany();
    for (const link of links) {
      await this.prisma.tenantMembership.upsert({
        where: {
          tenantId_userId: { tenantId: tenant.id, userId: link.coachId },
        },
        update: { active: true },
        create: {
          tenantId: tenant.id,
          userId: link.coachId,
          role: TenantMembershipRole.COACH,
        },
      });
      await this.prisma.clientMembership.upsert({
        where: {
          tenantId_userId: { tenantId: tenant.id, userId: link.clientId },
        },
        update: { status: ClientMembershipStatus.ACTIVE },
        create: {
          tenantId: tenant.id,
          userId: link.clientId,
          status: ClientMembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
    }

    await this.prisma.workoutProgram.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    });
    await this.prisma.mealPlan.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    });
    await this.prisma.messageThread.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    });
    await this.prisma.consultation.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    });
    await this.prisma.payment.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    });
    await this.prisma.aiInsight.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    });

    return tenant;
  }
}
