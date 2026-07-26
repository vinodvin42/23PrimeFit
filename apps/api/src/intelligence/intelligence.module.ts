import { Module } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { FeatureBuilderService } from './feature-builder.service';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceController } from './intelligence.controller';

@Module({
  imports: [ConsentModule],
  providers: [FeatureBuilderService, IntelligenceService],
  controllers: [IntelligenceController],
  exports: [IntelligenceService, FeatureBuilderService],
})
export class IntelligenceModule {}
