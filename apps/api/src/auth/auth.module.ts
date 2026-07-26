import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { FirebaseBearerStrategy } from './firebase-bearer.strategy';
import { CoachModule } from '../coach/coach.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'firebase-bearer' }),
    CoachModule,
  ],
  providers: [AuthService, FirebaseBearerStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
