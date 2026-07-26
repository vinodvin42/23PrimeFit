import { Module } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { FemaleHealthController } from './female-health.controller';
import { FemaleHealthService } from './female-health.service';

@Module({
  imports: [ConsentModule],
  controllers: [FemaleHealthController],
  providers: [FemaleHealthService],
  exports: [FemaleHealthService],
})
export class FemaleHealthModule {}
