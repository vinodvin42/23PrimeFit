import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { FemaleHealthService } from './female-health.service';

@ApiTags('female-health')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('female-health')
export class FemaleHealthController {
  constructor(private readonly femaleHealth: FemaleHealthService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.femaleHealth.today(user);
  }

  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.femaleHealth.profile(user);
  }

  @Put('profile')
  upsertProfile(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      trackingEnabled?: boolean;
      typicalCycleLength?: number;
      typicalPeriodLength?: number;
      lastPeriodStart?: string;
    },
  ) {
    return this.femaleHealth.upsertProfile(user, body);
  }

  @Get('cycles')
  cycles(@CurrentUser() user: AuthUser) {
    return this.femaleHealth.cycles(user);
  }

  @Post('cycles')
  createCycle(
    @CurrentUser() user: AuthUser,
    @Body() body: { periodStart: string; periodEnd?: string; notes?: string },
  ) {
    return this.femaleHealth.createCycle(user, body);
  }

  @Get('check-ins')
  checkIns(@CurrentUser() user: AuthUser) {
    return this.femaleHealth.checkIns(user);
  }

  @Post('check-ins')
  createCheckIn(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      dateKey?: string;
      symptoms?: string[];
      severity?: number;
      notes?: string;
    },
  ) {
    return this.femaleHealth.createCheckIn(user, body);
  }

  @Get('coach/clients/:clientId')
  coachClientSummary(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
  ) {
    return this.femaleHealth.coachClientSummary(user, clientId);
  }
}
