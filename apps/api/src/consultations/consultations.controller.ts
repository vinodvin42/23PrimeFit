import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConsultationStatus } from '@prisma/client';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { ConsultationsService } from './consultations.service';

@ApiTags('consultations')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.consultations.list(user);
  }

  @Post()
  book(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      topic: string;
      scheduledAt: string;
      durationMin?: number;
      notes?: string;
      amountInr?: number;
    },
  ) {
    return this.consultations.book(user, body);
  }

  @Get(':id/meeting')
  meeting(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.consultations.meeting(user, id);
  }

  @Patch(':id/status')
  status(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { status: ConsultationStatus },
  ) {
    return this.consultations.updateStatus(user, id, body.status);
  }

  @Post(':id/pay')
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.consultations.pay(user, id);
  }

  @Post(':id/confirm-payment')
  confirmPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: { razorpayOrderId?: string; razorpayPaymentId?: string },
  ) {
    return this.consultations.confirmPayment(user, id, body);
  }
}
