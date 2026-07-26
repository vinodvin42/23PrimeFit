import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantGuard } from './tenant.guard';

@Module({
  providers: [TenantsService, TenantGuard],
  controllers: [TenantsController],
  exports: [TenantsService, TenantGuard],
})
export class TenantsModule implements OnModuleInit {
  private readonly logger = new Logger(TenantsModule.name);

  constructor(private readonly tenants: TenantsService) {}

  async onModuleInit() {
    try {
      await this.tenants.ensureStarterPlan();
      await this.tenants.ensureProPlan();
      await this.tenants.migrateLegacyToInternal();
      this.logger.log('Tenant foundation ready (internal + plans)');
    } catch (err) {
      this.logger.warn(`Tenant bootstrap skipped: ${String(err)}`);
    }
  }
}
