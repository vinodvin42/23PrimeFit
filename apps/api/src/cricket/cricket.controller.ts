import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CricketRole,
  CricketSessionKind,
  CricketTeamLevel,
} from '@prisma/client';
import { FirebaseAuthGuard, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { CricketService } from './cricket.service';

@ApiTags('cricket')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('cricket')
export class CricketController {
  constructor(private readonly cricket: CricketService) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.cricket.getProfile(user);
  }

  @Put('profile')
  upsertProfile(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      primaryRole?: CricketRole;
      bowlingType?: string;
      battingHand?: string;
      teamLevel?: CricketTeamLevel;
    },
  ) {
    return this.cricket.upsertProfile(user, body);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.cricket.listSessions(user);
  }

  @Post('sessions')
  createSession(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      dateKey?: string;
      kind?: CricketSessionKind;
      durationMin?: number;
      rpe?: number;
      notes?: string;
      overs?: number;
      balls?: number;
      bowlIntensity?: string;
      batMinutes?: number;
      fieldMinutes?: number;
      runs?: number;
      ballsFaced?: number;
      wickets?: number;
      economy?: number;
      workoutSessionId?: string;
    },
  ) {
    return this.cricket.createSession(user, body);
  }

  @Get('sessions/:id')
  one(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cricket.getSession(user, id);
  }

  @Get('load')
  load(@CurrentUser() user: AuthUser) {
    return this.cricket.load(user);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.cricket.dashboard(user);
  }
}
