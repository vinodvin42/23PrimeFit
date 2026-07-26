import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { RecoveryService, type WearableSyncPayload } from './recovery.service';

@ApiTags('recovery')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('recovery')
export class RecoveryController {
  constructor(private readonly recovery: RecoveryService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.recovery.today(user);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.recovery.history(user, days ? Number(days) : 7);
  }

  @Get('connections')
  connections(@CurrentUser() user: AuthUser) {
    return this.recovery.connections(user);
  }

  @Post('sync')
  sync(@CurrentUser() user: AuthUser, @Body() body: WearableSyncPayload) {
    return this.recovery.sync(user, body);
  }

  @Post('sync/demo')
  syncDemo(@CurrentUser() user: AuthUser, @Body() body: { provider?: string }) {
    return this.recovery.syncDemo(user, body.provider || 'health_connect');
  }

  @Post('oauth/:provider/start')
  oauthStart(
    @CurrentUser() user: AuthUser,
    @Param('provider') provider: string,
  ) {
    const p = provider === 'whoop' ? 'whoop' : 'garmin';
    return this.recovery.startOauth(user, p);
  }

  @Post('oauth/:provider/complete')
  oauthComplete(
    @CurrentUser() user: AuthUser,
    @Param('provider') provider: string,
    @Body() body: { code?: string; state?: string },
  ) {
    const p = provider === 'whoop' ? 'whoop' : 'garmin';
    return this.recovery.completeOauth(user, p, body);
  }
}
