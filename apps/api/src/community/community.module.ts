import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';

@Module({
  imports: [TenantsModule],
  providers: [CommunityService],
  controllers: [CommunityController],
  exports: [CommunityService],
})
export class CommunityModule {}
