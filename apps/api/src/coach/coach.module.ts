import { Module } from '@nestjs/common';
import { CoachService } from './coach.service';
import { CoachController } from './coach.controller';
import { CoachAssignmentService } from './coach-assignment.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [NotificationsModule, TenantsModule],
  providers: [CoachService, CoachAssignmentService],
  controllers: [CoachController],
  exports: [CoachService, CoachAssignmentService],
})
export class CoachModule {}
