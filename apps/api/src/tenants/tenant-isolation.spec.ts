import { ForbiddenException } from '@nestjs/common';
import { assertSameTenant } from './tenant-isolation';
import type { ActiveTenantContext } from './tenant-context';

describe('tenant isolation', () => {
  const tenantA = {
    tenant: { id: 'tenant-a' },
    membership: null,
    role: 'COACH' as const,
    isPlatformAdmin: false,
  } as unknown as ActiveTenantContext;

  const tenantB = {
    tenant: { id: 'tenant-b' },
    membership: null,
    role: 'COACH' as const,
    isPlatformAdmin: false,
  } as unknown as ActiveTenantContext;

  it('allows same-tenant resource access', () => {
    expect(() => assertSameTenant(tenantA, 'tenant-a')).not.toThrow();
  });

  it('denies cross-tenant read/update/delete by id', () => {
    expect(() => assertSameTenant(tenantA, 'tenant-b')).toThrow(
      ForbiddenException,
    );
    expect(() => assertSameTenant(tenantB, 'tenant-a')).toThrow(
      ForbiddenException,
    );
  });

  it('allows platform admin across tenants', () => {
    const admin = {
      ...tenantA,
      isPlatformAdmin: true,
      role: 'PLATFORM_ADMIN',
    } as unknown as ActiveTenantContext;
    expect(() => assertSameTenant(admin, 'tenant-b')).not.toThrow();
  });
});
