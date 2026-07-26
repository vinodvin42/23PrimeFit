import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthUser } from '../auth/auth-user';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(user: AuthUser) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { profile: true },
    });
    if (!full) throw new NotFoundException('User not found');
    return full;
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    const { displayName, dateOfBirth, ...profileData } = dto;

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        profile: {
          upsert: {
            create: {
              ...profileData,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            },
            update: {
              ...profileData,
              ...(dateOfBirth !== undefined
                ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }
                : {}),
            },
          },
        },
      },
      include: { profile: true },
    });
  }

  async listCoachClients(coach: AuthUser) {
    return this.prisma.coachClient.findMany({
      where: { coachId: coach.id, active: true },
      include: {
        client: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
