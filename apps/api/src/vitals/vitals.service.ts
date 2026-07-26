import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AllergySeverity } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';

const DISCLAIMER =
  'These readings are a personal log for spotting trends — not a diagnosis or treatment recommendation. If a reading concerns you, contact a healthcare professional.';

type BodyMeasurementInput = {
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  notes?: string;
};

type TimelineEvent = {
  id: string;
  kind: string;
  title: string;
  occurredAt: Date;
};

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

  async listAllergies(user: AuthUser) {
    const allergies = await this.prisma.allergy.findMany({
      where: { userId: user.id, active: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      disclaimer:
        'A self-reported list to share with coaches and providers — not a clinical allergy test or diagnosis.',
      allergies,
    };
  }

  async addAllergy(
    user: AuthUser,
    body: { allergen: string; severity?: AllergySeverity; reaction?: string },
  ) {
    if (!body.allergen?.trim()) {
      throw new BadRequestException('allergen is required');
    }
    return this.prisma.allergy.create({
      data: {
        userId: user.id,
        allergen: body.allergen.trim(),
        severity: body.severity ?? AllergySeverity.MILD,
        reaction: body.reaction,
      },
    });
  }

  async removeAllergy(user: AuthUser, id: string) {
    const allergy = await this.prisma.allergy.findFirst({
      where: { id, userId: user.id },
    });
    if (!allergy) throw new NotFoundException('Allergy not found');
    return this.prisma.allergy.update({
      where: { id },
      data: { active: false },
    });
  }

  async listVaccinations(user: AuthUser) {
    const vaccinations = await this.prisma.vaccination.findMany({
      where: { userId: user.id },
      orderBy: { administeredAt: 'desc' },
    });
    return {
      disclaimer:
        'A self-reported record to share with coaches and providers — not an official immunization registry.',
      vaccinations,
    };
  }

  async addVaccination(
    user: AuthUser,
    body: {
      name: string;
      administeredAt: string;
      nextDueAt?: string;
      notes?: string;
    },
  ) {
    if (!body.name?.trim()) {
      throw new BadRequestException('name is required');
    }
    if (!body.administeredAt || Number.isNaN(Date.parse(body.administeredAt))) {
      throw new BadRequestException('administeredAt must be a valid date');
    }
    return this.prisma.vaccination.create({
      data: {
        userId: user.id,
        name: body.name.trim(),
        administeredAt: new Date(body.administeredAt),
        nextDueAt: body.nextDueAt ? new Date(body.nextDueAt) : undefined,
        notes: body.notes,
      },
    });
  }

  async removeVaccination(user: AuthUser, id: string) {
    const vaccination = await this.prisma.vaccination.findFirst({
      where: { id, userId: user.id },
    });
    if (!vaccination) throw new NotFoundException('Vaccination not found');
    await this.prisma.vaccination.delete({ where: { id } });
    return { id };
  }

  async listBodyMeasurements(user: AuthUser, days = 180) {
    const from = new Date(Date.now() - days * 86400000);
    const measurements = await this.prisma.bodyMeasurement.findMany({
      where: { userId: user.id, recordedAt: { gte: from } },
      orderBy: { recordedAt: 'desc' },
    });
    return { disclaimer: DISCLAIMER, measurements };
  }

  async addBodyMeasurement(user: AuthUser, body: BodyMeasurementInput) {
    const numericFields = [
      body.waistCm,
      body.hipCm,
      body.chestCm,
      body.armCm,
      body.thighCm,
      body.bodyFatPct,
      body.muscleMassKg,
    ];
    if (
      !numericFields.some((v) => typeof v === 'number' && Number.isFinite(v))
    ) {
      throw new BadRequestException(
        'at least one measurement value is required',
      );
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    return this.prisma.bodyMeasurement.create({
      data: {
        userId: user.id,
        waistCm: body.waistCm,
        hipCm: body.hipCm,
        chestCm: body.chestCm,
        armCm: body.armCm,
        thighCm: body.thighCm,
        bodyFatPct: body.bodyFatPct,
        muscleMassKg: body.muscleMassKg,
        notes: body.notes,
        dateKey,
      },
    });
  }

  async removeBodyMeasurement(user: AuthUser, id: string) {
    const measurement = await this.prisma.bodyMeasurement.findFirst({
      where: { id, userId: user.id },
    });
    if (!measurement) throw new NotFoundException('Measurement not found');
    await this.prisma.bodyMeasurement.delete({ where: { id } });
    return { id };
  }

  async getTimeline(user: AuthUser, days = 365) {
    const from = new Date(Date.now() - days * 86400000);
    const [
      bloodReports,
      photos,
      bloodPressure,
      bloodSugar,
      allergies,
      vaccinations,
      measurements,
    ] = await Promise.all([
      this.prisma.bloodReport.findMany({
        where: { userId: user.id, createdAt: { gte: from } },
      }),
      this.prisma.progressPhoto.findMany({
        where: { userId: user.id, takenAt: { gte: from } },
      }),
      this.prisma.bloodPressureReading.findMany({
        where: { userId: user.id, recordedAt: { gte: from } },
      }),
      this.prisma.bloodSugarReading.findMany({
        where: { userId: user.id, recordedAt: { gte: from } },
      }),
      this.prisma.allergy.findMany({
        where: { userId: user.id, createdAt: { gte: from } },
      }),
      this.prisma.vaccination.findMany({
        where: { userId: user.id, administeredAt: { gte: from } },
      }),
      this.prisma.bodyMeasurement.findMany({
        where: { userId: user.id, recordedAt: { gte: from } },
      }),
    ]);

    const events: TimelineEvent[] = [
      ...bloodReports.map((r) => ({
        id: r.id,
        kind: 'blood_report',
        title: `Blood report: ${r.title}`,
        occurredAt: r.createdAt,
      })),
      ...photos.map((p) => ({
        id: p.id,
        kind: 'progress_photo',
        title: `Progress photo (${p.pose})`,
        occurredAt: p.takenAt,
      })),
      ...bloodPressure.map((r) => ({
        id: r.id,
        kind: 'blood_pressure',
        title: `Blood pressure ${r.systolic}/${r.diastolic}`,
        occurredAt: r.recordedAt,
      })),
      ...bloodSugar.map((r) => ({
        id: r.id,
        kind: 'blood_sugar',
        title: `Blood sugar ${r.valueMgDl} mg/dL`,
        occurredAt: r.recordedAt,
      })),
      ...allergies.map((a) => ({
        id: a.id,
        kind: 'allergy',
        title: `Allergy logged: ${a.allergen}`,
        occurredAt: a.createdAt,
      })),
      ...vaccinations.map((v) => ({
        id: v.id,
        kind: 'vaccination',
        title: `Vaccination: ${v.name}`,
        occurredAt: v.administeredAt,
      })),
      ...measurements.map((m) => ({
        id: m.id,
        kind: 'body_measurement',
        title: 'Body measurement logged',
        occurredAt: m.recordedAt,
      })),
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return {
      disclaimer:
        'A personal timeline of what you logged — not a clinical medical record.',
      events,
    };
  }
}
