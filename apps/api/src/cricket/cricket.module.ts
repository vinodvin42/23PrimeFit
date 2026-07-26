import { Module } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { CricketService } from './cricket.service';
import { CricketController } from './cricket.controller';

@Module({
  imports: [ConsentModule, IntelligenceModule],
  providers: [CricketService],
  controllers: [CricketController],
  exports: [CricketService],
})
export class CricketModule {}
