import { Module } from '@nestjs/common';
import { RecoveryService } from './recovery.service';
import { RecoveryController } from './recovery.controller';
import { WearableOauthCallbackController } from './wearable-oauth-callback.controller';
import { ConsentModule } from '../consent/consent.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [ConsentModule, IntegrationsModule, IntelligenceModule],
  providers: [RecoveryService],
  controllers: [RecoveryController, WearableOauthCallbackController],
  exports: [RecoveryService],
})
export class RecoveryModule {}
