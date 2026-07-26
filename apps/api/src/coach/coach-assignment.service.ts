import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, TenantMembershipRole } from '@prisma/client';
import { TenantsService } from '../tenants/tenants.service';

/** Ensures every CLIENT has an active coach link (demo coach in local/dev). */
@Injectable()
export class CoachAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
  ) {}

  async ensureClientHasCoach(clientId: string) {
    const existing = await this.prisma.coachClient.findFirst({
      where: { clientId, active: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;

    const tenant = await this.tenants.ensureInternalTenant();
    const coach = await this.resolveDemoCoach();

    await this.prisma.tenantMembership.upsert({
      where: {
        tenantId_userId: { tenantId: tenant.id, userId: coach.id },
      },
      update: { active: true },
      create: {
        tenantId: tenant.id,
        userId: coach.id,
        role: TenantMembershipRole.COACH,
      },
    });

    await this.prisma.clientMembership.upsert({
      where: {
        tenantId_userId: { tenantId: tenant.id, userId: clientId },
      },
      update: { status: 'ACTIVE' },
      create: {
        tenantId: tenant.id,
        userId: clientId,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });

    return this.prisma.coachClient.upsert({
      where: {
        tenantId_coachId_clientId: {
          tenantId: tenant.id,
          coachId: coach.id,
          clientId,
        },
      },
      update: { active: true, notes: 'Auto-assigned demo coach' },
      create: {
        tenantId: tenant.id,
        coachId: coach.id,
        clientId,
        notes: 'Auto-assigned demo coach',
      },
    });
  }

  private async resolveDemoCoach() {
    const byUid = await this.prisma.user.findUnique({
      where: { firebaseUid: 'coach-demo' },
    });
    if (byUid) {
      if (byUid.role !== Role.COACH) {
        return this.prisma.user.update({
          where: { id: byUid.id },
          data: {
            role: Role.COACH,
            displayName: byUid.displayName ?? 'Coach Priya',
          },
        });
      }
      return byUid;
    }

    const anyCoach = await this.prisma.user.findFirst({
      where: { role: Role.COACH },
      orderBy: { createdAt: 'asc' },
    });
    if (anyCoach) return anyCoach;

    return this.prisma.user.create({
      data: {
        firebaseUid: 'coach-demo',
        email: 'coach-demo@dev.local',
        displayName: 'Coach Priya',
        role: Role.COACH,
        profile: { create: { onboardingComplete: true } },
      },
    });
  }
}
