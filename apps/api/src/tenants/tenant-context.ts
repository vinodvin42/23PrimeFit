import type {
  Tenant,
  TenantMembership,
  TenantMembershipRole,
} from '@prisma/client';

export const TENANT_HEADER = 'x-tenant-id';

export type ActiveTenantContext = {
  tenant: Tenant;
  membership: TenantMembership | null;
  role: TenantMembershipRole | 'PLATFORM_ADMIN' | 'CLIENT';
  isPlatformAdmin: boolean;
};
