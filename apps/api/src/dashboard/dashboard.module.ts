import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { WorkoutsModule } from '../workouts/workouts.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { RecoveryModule } from '../recovery/recovery.module';
import { ProgressModule } from '../progress/progress.module';

@Module({
  imports: [WorkoutsModule, NutritionModule, RecoveryModule, ProgressModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
