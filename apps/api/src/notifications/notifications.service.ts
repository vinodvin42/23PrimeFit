import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { FcmAdapter } from '../integrations/fcm.adapter';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmAdapter,
  ) {}

  list(user: AuthUser) {
    return this.prisma.appNotification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async registerDevice(
    user: AuthUser,
    body: { token: string; platform?: string },
  ) {
    const token = body.token?.trim();
    if (!token) throw new NotFoundException('token required');
    await this.prisma.profile.upsert({
      where: { userId: user.id },
      update: { fcmToken: token },
      create: { userId: user.id, fcmToken: token },
    });
    return { ok: true, platform: body.platform ?? 'unknown' };
  }

  async pushToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload.data ?? {})) {
      data[k] = String(v);
    }
    const row = await this.prisma.appNotification.create({
      data: {
        userId,
        title: payload.title,
        body: payload.body,
        type: data.type ?? 'push',
        dataJson: JSON.stringify(data),
      },
    });
    const fcm = profile?.fcmToken
      ? await this.fcm.sendToToken(profile.fcmToken, {
          title: payload.title,
          body: payload.body,
          data,
        })
      : { mode: 'stub' as const, sent: false };
    this.logger.debug(`notify ${userId} fcm=${JSON.stringify(fcm)}`);
    return { notification: row, fcm };
  }

  async markRead(user: AuthUser, id: string) {
    const n = await this.prisma.appNotification.findFirst({
      where: { id, userId: user.id },
    });
    if (!n) throw new NotFoundException('Notification not found');
    return this.prisma.appNotification.update({
      where: { id },
      data: { read: true },
    });
  }

  markAllRead(user: AuthUser) {
    return this.prisma.appNotification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  }

  unreadCount(user: AuthUser) {
    return this.prisma.appNotification.count({
      where: { userId: user.id, read: false },
    });
  }
}
