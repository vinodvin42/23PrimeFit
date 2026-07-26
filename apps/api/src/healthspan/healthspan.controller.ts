import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { HealthspanService } from './healthspan.service';

@ApiTags('healthspan')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('healthspan')
export class HealthspanController {
  constructor(private readonly healthspan: HealthspanService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.healthspan.today(user);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.healthspan.history(user, from, to);
  }
}
