import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { RecoveryModule } from './recovery/recovery.module';
import { CoachModule } from './coach/coach.module';
import { ChatModule } from './chat/chat.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';
import { ProgressModule } from './progress/progress.module';
import { ConsentModule } from './consent/consent.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { CricketModule } from './cricket/cricket.module';
import { TenantsModule } from './tenants/tenants.module';
import { FemaleHealthModule } from './female-health/female-health.module';
import { HealthspanModule } from './healthspan/healthspan.module';
import { VisionModule } from './vision/vision.module';
import { CrmModule } from './crm/crm.module';
import { PlatformModule } from './platform/platform.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { PartnerModule } from './partner/partner.module';
import { CommunityModule } from './community/community.module';
import { HealthController } from './health.controller';
import { PaymentsWebhookController } from './consultations/payments-webhook.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    IntegrationsModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    DashboardModule,
    WorkoutsModule,
    NutritionModule,
    RecoveryModule,
    CoachModule,
    ChatModule,
    ConsultationsModule,
    NotificationsModule,
    AiModule,
    ProgressModule,
    ConsentModule,
    IntelligenceModule,
    CricketModule,
    FemaleHealthModule,
    HealthspanModule,
    VisionModule,
    CrmModule,
    PlatformModule,
    MarketplaceModule,
    PartnerModule,
    CommunityModule,
  ],
  controllers: [HealthController, PaymentsWebhookController],
})
export class AppModule {}
