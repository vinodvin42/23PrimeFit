import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { WearableOauthAdapter } from '../integrations/wearable-oauth.adapter';

/** Vendor redirect target — no auth (state encodes user). */
@ApiExcludeController()
@Controller('recovery/oauth')
export class WearableOauthCallbackController {
  constructor(private readonly oauth: WearableOauthAdapter) {}

  @Get(':provider/callback')
  callback(
    @Param('provider') provider: string,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    const p = provider === 'whoop' ? 'whoop' : 'garmin';
    return this.oauth.complete(p, code, state);
  }
}
