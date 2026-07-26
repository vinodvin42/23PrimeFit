import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';

const DISCLAIMER =
  'These readings are a personal log for spotting trends — not a diagnosis or treatment recommendation. If a reading concerns you, contact a healthcare professional.';

@Injectable()
export class VitalsService {
  constructor(private readonly prisma: PrismaService) {}

  async listBloodPressure(user: AuthUser, days = 90) {
    const from = new Date(Date.now() - days * 86400000);
    const readings = await this.prisma.bloodPressureReading.findMany({
      where: { userId: user.id, recordedAt: { gte: from } },
      orderBy: { recordedAt: 'desc' },
    });
    return { disclaimer: DISCLAIMER, readings };
  }

  async logBloodPressure(
    user: AuthUser,
    body: {
      systolic: number;
      diastolic: number;
      pulseBpm?: number;
      notes?: string;
    },
  ) {
    if (
      !Number.isFinite(body.systolic) ||
      body.systolic < 40 ||
      body.systolic > 260
    ) {
      throw new BadRequestException('systolic must be between 40 and 260');
    }
    if (
      !Number.isFinite(body.diastolic) ||
      body.diastolic < 20 ||
      body.diastolic > 200
    ) {
      throw new BadRequestException('diastolic must be between 20 and 200');
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    return this.prisma.bloodPressureReading.create({
      data: {
        userId: user.id,
        systolic: Math.round(body.systolic),
        diastolic: Math.round(body.diastolic),
        pulseBpm: body.pulseBpm ? Math.round(body.pulseBpm) : undefined,
        notes: body.notes,
        dateKey,
      },
    });
  }

  async removeBloodPressure(user: AuthUser, id: string) {
    const reading = await this.prisma.bloodPressureReading.findFirst({
      where: { id, userId: user.id },
    });
    if (!reading) throw new NotFoundException('Reading not found');
    await this.prisma.bloodPressureReading.delete({ where: { id } });
    return { id };
  }

  async listBloodSugar(user: AuthUser, days = 90) {
    const from = new Date(Date.now() - days * 86400000);
    const readings = await this.prisma.bloodSugarReading.findMany({
      where: { userId: user.id, recordedAt: { gte: from } },
      orderBy: { recordedAt: 'desc' },
    });
    return { disclaimer: DISCLAIMER, readings };
  }

  async logBloodSugar(
    user: AuthUser,
    body: { valueMgDl: number; context?: string; notes?: string },
  ) {
    if (
      !Number.isFinite(body.valueMgDl) ||
      body.valueMgDl < 20 ||
      body.valueMgDl > 600
    ) {
      throw new BadRequestException('valueMgDl must be between 20 and 600');
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    return this.prisma.bloodSugarReading.create({
      data: {
        userId: user.id,
        valueMgDl: body.valueMgDl,
        context: body.context,
        notes: body.notes,
        dateKey,
      },
    });
  }

  async removeBloodSugar(user: AuthUser, id: string) {
    const reading = await this.prisma.bloodSugarReading.findFirst({
      where: { id, userId: user.id },
    });
    if (!reading) throw new NotFoundException('Reading not found');
    await this.prisma.bloodSugarReading.delete({ where: { id } });
    return { id };
  }
}
