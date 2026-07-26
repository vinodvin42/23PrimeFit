import { Module } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { HealthspanController } from './healthspan.controller';
import { HealthspanService } from './healthspan.service';

@Module({
  imports: [ConsentModule],
  controllers: [HealthspanController],
  providers: [HealthspanService],
})
export class HealthspanModule {}
