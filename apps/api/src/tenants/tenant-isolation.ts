import { ForbiddenException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import type { ActiveTenantContext } from './tenant-context';

/**
 * Pure helper used by unit tests and services for cross-tenant denial.
 */
export function assertSameTenant(
  ctx: ActiveTenantContext,
  resourceTenantId: string | null | undefined,
) {
  if (!resourceTenantId) return;
  if (ctx.isPlatformAdmin) return;
  if (resourceTenantId !== ctx.tenant.id) {
    throw new ForbiddenException('Cross-tenant access denied');
  }
}

export async function denyCrossTenantAccess(
  tenants: TenantsService,
  ctx: ActiveTenantContext,
  resourceTenantId: string | null | undefined,
) {
  await tenants.assertCanAccessTenantResource(ctx, resourceTenantId);
}
