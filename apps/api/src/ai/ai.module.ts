import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ConsentModule } from '../consent/consent.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConsentModule,
    IntegrationsModule,
    IntelligenceModule,
    StorageModule,
    NotificationsModule,
  ],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
