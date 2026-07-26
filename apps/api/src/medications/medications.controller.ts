import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { MedicationsService } from './medications.service';

@ApiTags('medications')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('medications')
export class MedicationsController {
  constructor(private readonly medications: MedicationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.medications.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; dosage?: string; schedule?: string },
  ) {
    return this.medications.create(user, body);
  }

  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.medications.deactivate(user, id);
  }

  @Post(':id/log')
  logTaken(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.medications.logTaken(user, id);
  }

  @Delete(':id/log')
  unlogTaken(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.medications.unlogTaken(user, id);
  }
}
