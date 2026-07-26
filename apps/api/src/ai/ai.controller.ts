import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.ai.dashboard(user);
  }

  @Post('insights/generate')
  generate(@CurrentUser() user: AuthUser) {
    return this.ai.generateInsights(user);
  }

  @Get('insights/pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.ai.pendingForCoach(user);
  }

  @Patch('insights/:id/review')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; editedBody?: string },
  ) {
    return this.ai.reviewInsight(user, id, body);
  }

  @Post('biological-age')
  biologicalAge(@CurrentUser() user: AuthUser) {
    return this.ai.calculateBiologicalAge(user);
  }

  @Get('blood-reports')
  bloodReports(@CurrentUser() user: AuthUser) {
    return this.ai.listBloodReports(user);
  }

  @Get('blood-reports/:id')
  bloodReport(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ai.getBloodReport(user, id);
  }

  @Post('blood-reports')
  upload(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      title?: string;
      fileName: string;
      markers?: Record<string, number>;
      ocrText?: string;
      imageBase64?: string;
      mimeType?: string;
    },
  ) {
    return this.ai.uploadBloodReport(user, body);
  }
}
