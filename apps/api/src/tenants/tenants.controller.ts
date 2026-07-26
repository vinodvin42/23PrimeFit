import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { TENANT_HEADER } from './tenant-context';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('plans')
  listPlans() {
    return this.tenants.listPlans();
  }

  @Get('platform/tenants')
  platformTenants(@CurrentUser() user: AuthUser) {
    return this.tenants.listTenantsPlatformAdmin(user);
  }

  @Get('me')
  @ApiHeader({ name: TENANT_HEADER, required: false })
  async myTenants(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenantId?: string,
  ) {
    const memberships = await this.tenants.listMembershipsForUser(user);
    const active = await this.tenants.resolveActiveTenant(user, tenantId);
    return { ...memberships, active };
  }

  @Post('register')
  register(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; slug?: string },
  ) {
    return this.tenants.registerCoachWorkspace(user, body);
  }

  @Post('invitations/:token/accept')
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.tenants.acceptInvitation(user, token);
  }

  @Post(':tenantId/activate-subscription')
  activate(
    @CurrentUser() user: AuthUser,
    @Param('tenantId') tenantId: string,
  ) {
    return this.tenants.activateSubscriptionDemo(user, tenantId);
  }

  @Post(':tenantId/invitations')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('tenantId') tenantId: string,
    @Body() body: { email: string },
  ) {
    return this.tenants.inviteClient(user, tenantId, body);
  }

  @Get(':tenantId/usage')
  usage(
    @CurrentUser() user: AuthUser,
    @Param('tenantId') tenantId: string,
  ) {
    return this.tenants.usageSummary(user, tenantId);
  }
}
