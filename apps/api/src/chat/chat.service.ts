import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { CoachAssignmentService } from '../coach/coach-assignment.service';
import { StreamAdapter } from '../integrations/stream.adapter';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coachAssignment: CoachAssignmentService,
    private readonly stream: StreamAdapter,
    private readonly notifications: NotificationsService,
  ) {}

  private async resolveCoachClientPair(user: AuthUser, otherUserId: string) {
    if (user.role === 'COACH' || user.role === 'ADMIN') {
      return { coachId: user.id, clientId: otherUserId };
    }
    const link = await this.prisma.coachClient.findFirst({
      where: { clientId: user.id, active: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!link) throw new NotFoundException('No coach assigned');
    return { coachId: link.coachId, clientId: user.id };
  }

  async listThreads(user: AuthUser) {
    const where =
      user.role === 'COACH' || user.role === 'ADMIN'
        ? { coachId: user.id }
        : { clientId: user.id };

    const threads = await this.prisma.messageThread.findMany({
      where,
      include: {
        coach: true,
        client: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return threads.map((t) => ({
      ...t,
      lastMessage: t.messages[0] ?? null,
      messages: undefined,
      provider: this.stream.enabled ? 'stream' : 'postgres',
    }));
  }

  async ensureThread(user: AuthUser, otherUserId?: string) {
    let coachId: string;
    let clientId: string;

    if (user.role === 'COACH' || user.role === 'ADMIN') {
      if (!otherUserId) throw new NotFoundException('clientId required');
      const link = await this.prisma.coachClient.findFirst({
        where: { coachId: user.id, clientId: otherUserId, active: true },
      });
      if (!link) throw new NotFoundException('Client not linked');
      coachId = user.id;
      clientId = otherUserId;
    } else {
      await this.coachAssignment.ensureClientHasCoach(user.id);
      const link = await this.prisma.coachClient.findFirst({
        where: { clientId: user.id, active: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (!link) throw new NotFoundException('No coach assigned');
      coachId = link.coachId;
      clientId = user.id;
    }

    return this.prisma.messageThread.upsert({
      where: { coachId_clientId: { coachId, clientId } },
      update: {},
      create: {
        coachId,
        clientId,
        subject: 'Coaching chat',
      },
      include: { coach: true, client: true },
    });
  }

  async getMessages(user: AuthUser, threadId: string) {
    const thread = await this.prisma.messageThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.coachId !== user.id && thread.clientId !== user.id) {
      throw new ForbiddenException();
    }

    const messages = await this.prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      include: { sender: true },
    });

    return {
      thread,
      messages,
      provider: this.stream.enabled ? 'stream' : 'postgres',
    };
  }

  async sendMessage(user: AuthUser, threadId: string, body: string) {
    const thread = await this.prisma.messageThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.coachId !== user.id && thread.clientId !== user.id) {
      throw new ForbiddenException();
    }
    if (!body?.trim()) throw new NotFoundException('Message body required');

    const message = await this.prisma.message.create({
      data: {
        threadId,
        senderId: user.id,
        body: body.trim(),
      },
      include: { sender: true },
    });

    await this.prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    const recipientId =
      user.id === thread.coachId ? thread.clientId : thread.coachId;
    await this.notifications.pushToUser(recipientId, {
      title: 'New message',
      body: body.trim().slice(0, 120),
      data: { threadId, type: 'chat_message' },
    });

    try {
      await this.stream.syncThreadMessage({
        threadId,
        coachId: thread.coachId,
        clientId: thread.clientId,
        senderId: user.id,
        text: body.trim(),
      });
    } catch {
      /* Postgres remains source of truth */
    }

    return {
      ...message,
      provider: this.stream.enabled ? 'stream' : 'postgres',
    };
  }
}
