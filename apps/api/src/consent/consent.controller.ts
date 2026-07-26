import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { ConsentService } from './consent.service';

@ApiTags('consent')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('consent')
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.consent.list(user);
  }

  @Get('purposes')
  purposes() {
    return { purposes: this.consent.purposes() };
  }

  @Put()
  upsert(
    @CurrentUser() user: AuthUser,
    @Body() body: { purpose: string; granted: boolean; version?: string },
  ) {
    return this.consent.upsert(
      user,
      body.purpose,
      Boolean(body.granted),
      body.version ?? '1',
    );
  }

  @Get('sensitive-data/:domain/export')
  exportSensitiveData(
    @CurrentUser() user: AuthUser,
    @Param('domain') domain: 'female-health' | 'healthspan',
  ) {
    return this.consent.exportSensitiveData(user, this.sensitiveDomain(domain));
  }

  @Delete('sensitive-data/:domain')
  deleteSensitiveData(
    @CurrentUser() user: AuthUser,
    @Param('domain') domain: 'female-health' | 'healthspan',
  ) {
    return this.consent.deleteSensitiveData(user, this.sensitiveDomain(domain));
  }

  private sensitiveDomain(domain: string): 'female-health' | 'healthspan' {
    if (domain === 'female-health' || domain === 'healthspan') return domain;
    throw new BadRequestException('Unsupported sensitive data domain');
  }
}
