import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { VitalsService } from './vitals.service';

@ApiTags('vitals')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('vitals')
export class VitalsController {
  constructor(private readonly vitals: VitalsService) {}

  @Get('blood-pressure')
  listBloodPressure(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string,
  ) {
    return this.vitals.listBloodPressure(user, days ? Number(days) : 90);
  }

  @Post('blood-pressure')
  logBloodPressure(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      systolic: number;
      diastolic: number;
      pulseBpm?: number;
      notes?: string;
    },
  ) {
    return this.vitals.logBloodPressure(user, body);
  }

  @Delete('blood-pressure/:id')
  removeBloodPressure(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vitals.removeBloodPressure(user, id);
  }

  @Get('blood-sugar')
  listBloodSugar(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.vitals.listBloodSugar(user, days ? Number(days) : 90);
  }

  @Post('blood-sugar')
  logBloodSugar(
    @CurrentUser() user: AuthUser,
    @Body() body: { valueMgDl: number; context?: string; notes?: string },
  ) {
    return this.vitals.logBloodSugar(user, body);
  }

  @Delete('blood-sugar/:id')
  removeBloodSugar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vitals.removeBloodSugar(user, id);
  }
}
