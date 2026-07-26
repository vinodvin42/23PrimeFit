import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TenantsService } from './tenants.service';

@Injectable()
export class TenantBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TenantBootstrapService.name);

  constructor(private readonly tenants: TenantsService) {}

  async onModuleInit() {
    try {
      const tenant = await this.tenants.migrateLegacyToInternal();
      this.logger.log(
        `Multi-tenant ready — internal tenant ${tenant.slug} (${tenant.id})`,
      );
    } catch (err) {
      this.logger.warn(`Tenant bootstrap skipped: ${String(err)}`);
    }
  }
}
