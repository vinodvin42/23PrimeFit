import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import type { AuthUser } from '../auth/auth-user';
import { ActiveTenantContext, TENANT_HEADER } from './tenant-context';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
      activeTenant?: ActiveTenantContext;
    }>();
    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }
    const raw = req.headers[TENANT_HEADER] ?? req.headers['X-Tenant-Id'];
    const tenantId = Array.isArray(raw) ? raw[0] : raw;
    req.activeTenant = await this.tenants.resolveActiveTenant(
      req.user,
      tenantId,
    );
    return true;
  }
}

export const ActiveTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveTenantContext => {
    const req = ctx.switchToHttp().getRequest<{
      activeTenant?: ActiveTenantContext;
    }>();
    if (!req.activeTenant) {
      throw new UnauthorizedException('Active tenant context missing');
    }
    return req.activeTenant;
  },
);
