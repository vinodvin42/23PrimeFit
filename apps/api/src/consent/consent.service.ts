import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';

export const CONSENT_PURPOSES = [
  'wearable_sync',
  'blood_report_analysis',
  'ai_coaching',
  'injury_risk_insights',
  'predictive_insights',
  'cricket_analytics',
  'female_health_tracking',
  'female_health_coach_share',
  'healthspan_insights',
] as const;

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.consentRecord.findMany({
      where: { userId: user.id },
      orderBy: { purpose: 'asc' },
    });
  }

  async upsert(
    user: AuthUser,
    purpose: string,
    granted: boolean,
    version = '1',
  ) {
    const now = new Date();
    const record = await this.prisma.consentRecord.upsert({
      where: {
        userId_purpose: { userId: user.id, purpose },
      },
      update: {
        granted,
        version,
        grantedAt: granted ? now : undefined,
        revokedAt: granted ? null : now,
      },
      create: {
        userId: user.id,
        purpose,
        granted,
        version,
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        userId: user.id,
        action: granted ? 'consent.granted' : 'consent.revoked',
        resource: 'ConsentRecord',
        resourceId: record.id,
        metaJson: JSON.stringify({ purpose, version }),
      },
    });

    return record;
  }

  purposes() {
    return CONSENT_PURPOSES;
  }

  async hasGranted(userId: string, purpose: string) {
    const row = await this.prisma.consentRecord.findUnique({
      where: { userId_purpose: { userId, purpose } },
    });
    return row?.granted === true;
  }

  async requireGranted(userId: string, purpose: string) {
    if (!(await this.hasGranted(userId, purpose))) {
      throw new ForbiddenException(`Consent required for ${purpose}.`);
    }
  }

  async exportSensitiveData(
    user: AuthUser,
    domain: 'female-health' | 'healthspan',
  ) {
    let data: Record<string, unknown>;
    if (domain === 'female-health') {
      const [profile, cycles, symptomCheckIns] = await Promise.all([
        this.prisma.femaleHealthProfile.findUnique({
          where: { userId: user.id },
        }),
        this.prisma.cycleLog.findMany({
          where: { userId: user.id },
          orderBy: { periodStart: 'asc' },
        }),
        this.prisma.symptomCheckIn.findMany({
          where: { userId: user.id },
          orderBy: { dateKey: 'asc' },
        }),
      ]);
      data = { profile, cycles, symptomCheckIns };
    } else {
      data = {
        snapshots: await this.prisma.healthspanSnapshot.findMany({
          where: { userId: user.id },
          orderBy: { dateKey: 'asc' },
        }),
      };
    }
    await this.auditDataRight(user, 'sensitive_data.exported', domain);
    return { domain, exportedAt: new Date().toISOString(), data };
  }

  async deleteSensitiveData(
    user: AuthUser,
    domain: 'female-health' | 'healthspan',
  ) {
    if (domain === 'female-health') {
      await this.prisma.$transaction([
        this.prisma.cycleLog.deleteMany({ where: { userId: user.id } }),
        this.prisma.symptomCheckIn.deleteMany({ where: { userId: user.id } }),
        this.prisma.femaleHealthProfile.deleteMany({
          where: { userId: user.id },
        }),
      ]);
    } else {
      await this.prisma.healthspanSnapshot.deleteMany({
        where: { userId: user.id },
      });
    }
    await this.auditDataRight(user, 'sensitive_data.deleted', domain);
    return { deleted: true, domain };
  }

  private auditDataRight(user: AuthUser, action: string, domain: string) {
    return this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        userId: user.id,
        action,
        resource: domain,
        metaJson: JSON.stringify({ domain }),
      },
    });
  }
}
