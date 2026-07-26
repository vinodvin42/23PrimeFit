import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { IntelligenceService } from './intelligence.service';

@ApiTags('intelligence')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('intelligence')
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Post('run')
  run(@CurrentUser() user: AuthUser) {
    return this.intelligence.run(user);
  }

  @Post('run-all')
  runAll(@CurrentUser() user: AuthUser) {
    if (user.role !== 'ADMIN') {
      return this.intelligence.run(user);
    }
    return this.intelligence.runForActiveUsers();
  }

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.intelligence.today(user);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.intelligence.history(user, from, to);
  }

  @Post('outcomes')
  createOutcome(
    @CurrentUser() user: AuthUser,
    @Body()
    body: { userId?: string; dateKey?: string; kind: string; note?: string },
  ) {
    return this.intelligence.createOutcome(user, body);
  }

  @Get('outcomes')
  listOutcomes(
    @CurrentUser() user: AuthUser,
    @Query('clientId') clientId?: string,
  ) {
    return this.intelligence.listOutcomes(user, clientId);
  }
}
