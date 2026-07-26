import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MedicationsService {
  private readonly disclaimer =
    'This is a personal reminder log, not a prescription or medical record — always follow your doctor or pharmacist instructions and never change a dose based on this app.';

  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    const dateKey = new Date().toISOString().slice(0, 10);
    const medications = await this.prisma.medication.findMany({
      where: { userId: user.id, active: true },
      orderBy: { createdAt: 'asc' },
      include: { logs: { where: { dateKey } } },
    });
    return {
      disclaimer: this.disclaimer,
      medications: medications.map((m) => {
        const { logs, ...rest } = m;
        return { ...rest, takenToday: logs.length > 0 };
      }),
    };
  }

  async create(
    user: AuthUser,
    body: { name: string; dosage?: string; schedule?: string },
  ) {
    if (!body.name?.trim()) {
      throw new BadRequestException('name is required');
    }
    return this.prisma.medication.create({
      data: {
        userId: user.id,
        name: body.name.trim(),
        dosage: body.dosage,
        schedule: body.schedule,
      },
    });
  }

  async deactivate(user: AuthUser, id: string) {
    const medication = await this.prisma.medication.findFirst({
      where: { id, userId: user.id },
    });
    if (!medication) throw new NotFoundException('Medication not found');
    return this.prisma.medication.update({
      where: { id },
      data: { active: false },
    });
  }

  async logTaken(user: AuthUser, id: string) {
    const medication = await this.prisma.medication.findFirst({
      where: { id, userId: user.id },
    });
    if (!medication) throw new NotFoundException('Medication not found');
    const dateKey = new Date().toISOString().slice(0, 10);
    return this.prisma.medicationLog.upsert({
      where: { medicationId_dateKey: { medicationId: id, dateKey } },
      update: {},
      create: { userId: user.id, medicationId: id, dateKey },
    });
  }

  async unlogTaken(user: AuthUser, id: string) {
    const medication = await this.prisma.medication.findFirst({
      where: { id, userId: user.id },
    });
    if (!medication) throw new NotFoundException('Medication not found');
    const dateKey = new Date().toISOString().slice(0, 10);
    await this.prisma.medicationLog.deleteMany({
      where: { medicationId: id, dateKey },
    });
    return { medicationId: id, dateKey, takenToday: false };
  }
}
