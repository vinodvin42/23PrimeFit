import { Body, Controller, ForbiddenException, Get, Injectable, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiInsightStatus } from '@prisma/client';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VisionService {
  constructor(private readonly prisma: PrismaService) {}

  private recognize(hint = '') {
    const value = hint.toLowerCase();
    if (value.includes('chicken')) return { name: 'Chicken rice bowl', calories: 620, proteinG: 42, carbsG: 72, fatG: 15 };
    if (value.includes('salad')) return { name: 'Protein salad', calories: 360, proteinG: 26, carbsG: 28, fatG: 16 };
    return { name: 'Mixed meal', calories: 480, proteinG: 24, carbsG: 55, fatG: 18 };
  }

  async food(user: AuthUser, body: { tenantId?: string; imageUrl?: string; hint?: string; recognizedName?: string; calories?: number; proteinG?: number; carbsG?: number; fatG?: number }) {
    const recognized = this.recognize(body.hint);
    return this.prisma.foodVisionLog.create({
      data: {
        tenantId: body.tenantId,
        userId: user.id,
        imageUrl: body.imageUrl,
        recognizedName: body.recognizedName ?? recognized.name,
        calories: body.calories ?? recognized.calories,
        proteinG: body.proteinG ?? recognized.proteinG,
        carbsG: body.carbsG ?? recognized.carbsG,
        fatG: body.fatG ?? recognized.fatG,
      },
    });
  }

  async posture(user: AuthUser, body: { tenantId?: string; imageUrl?: string; notes?: string }) {
    const summary = 'Draft posture screen: review hip and shoulder alignment with a qualified coach.';
    const analysis = await this.prisma.postureAnalysis.create({
      data: { tenantId: body.tenantId, userId: user.id, imageUrl: body.imageUrl, summary, findingsJson: JSON.stringify([{ area: 'alignment', note: body.notes ?? 'Visual check required' }]) },
    });
    await this.prisma.aiInsight.create({ data: { tenantId: body.tenantId, userId: user.id, category: 'vision', title: 'Posture analysis awaiting review', body: summary, severity: 'info', source: 'vision-rules', status: AiInsightStatus.DRAFT } });
    return analysis;
  }

  mine(user: AuthUser) {
    return Promise.all([
      this.prisma.foodVisionLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.prisma.postureAnalysis.findMany({ where: { userId: user.id, ...(user.role === 'CLIENT' ? { status: AiInsightStatus.APPROVED } : {}) }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]).then(([food, posture]) => ({ food, posture }));
  }

  async approve(coach: AuthUser, id: string, body: { status: 'APPROVED' | 'REJECTED'; coachNotes?: string }) {
    if (!['COACH', 'ADMIN'].includes(coach.role)) throw new ForbiddenException('Coach role required');
    return this.prisma.postureAnalysis.update({ where: { id }, data: { status: body.status as AiInsightStatus, coachNotes: body.coachNotes, reviewedById: coach.id, reviewedAt: new Date() } });
  }
}

@ApiTags('vision')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('vision')
export class VisionController {
  constructor(private readonly service: VisionService) {}
  @Post('food') food(@CurrentUser() user: AuthUser, @Body() body: Parameters<VisionService['food']>[1]) { return this.service.food(user, body); }
  @Post('posture') posture(@CurrentUser() user: AuthUser, @Body() body: Parameters<VisionService['posture']>[1]) { return this.service.posture(user, body); }
  @Get('mine') mine(@CurrentUser() user: AuthUser) { return this.service.mine(user); }
  @Patch('posture/:id/review') review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED'; coachNotes?: string }) { return this.service.approve(user, id, body); }
}

import { Module } from '@nestjs/common';
@Module({ providers: [VisionService], controllers: [VisionController] })
export class VisionModule {}
