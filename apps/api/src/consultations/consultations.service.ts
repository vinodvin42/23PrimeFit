import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { ConsultationStatus, PaymentStatus } from '@prisma/client';
import { CoachAssignmentService } from '../coach/coach-assignment.service';
import { AgoraAdapter } from '../integrations/agora.adapter';
import { RazorpayAdapter } from '../integrations/razorpay.adapter';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coachAssignment: CoachAssignmentService,
    private readonly agora: AgoraAdapter,
    private readonly razorpay: RazorpayAdapter,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser) {
    const where =
      user.role === 'COACH' || user.role === 'ADMIN'
        ? { coachId: user.id }
        : { clientId: user.id };

    return this.prisma.consultation.findMany({
      where,
      include: {
        coach: true,
        client: true,
        payment: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async book(
    user: AuthUser,
    body: {
      topic: string;
      scheduledAt: string;
      durationMin?: number;
      notes?: string;
      amountInr?: number;
      coachId?: string;
    },
  ) {
    let coachId = body.coachId;
    const clientId = user.id;

    if (user.role === 'COACH' || user.role === 'ADMIN') {
      throw new ForbiddenException(
        'Clients book consultations; coaches confirm them',
      );
    }

    if (!coachId) {
      await this.coachAssignment.ensureClientHasCoach(user.id);
      const link = await this.prisma.coachClient.findFirst({
        where: { clientId: user.id, active: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (!link) throw new NotFoundException('No coach assigned');
      coachId = link.coachId;
    }

    const scheduledAt = new Date(body.scheduledAt);
    const amountInr = body.amountInr ?? 999;
    const draftId = crypto.randomUUID();
    const agora = this.agora.meetingFor(draftId);

    const consult = await this.prisma.consultation.create({
      data: {
        coachId,
        clientId,
        topic: body.topic,
        notes: body.notes,
        scheduledAt,
        durationMin: body.durationMin ?? 30,
        status: ConsultationStatus.REQUESTED,
        meetingUrl: agora.meetingUrl,
        amountInr,
      },
      include: { coach: true, client: true },
    });

    // Refresh Agora channel with real consultation id
    const liveAgora = this.agora.meetingFor(consult.id);
    if (liveAgora.meetingUrl !== consult.meetingUrl) {
      await this.prisma.consultation.update({
        where: { id: consult.id },
        data: { meetingUrl: liveAgora.meetingUrl },
      });
      consult.meetingUrl = liveAgora.meetingUrl;
    }

    await this.notifications.pushToUser(coachId, {
      title: 'Consultation requested',
      body: `${user.displayName ?? 'Client'} requested: ${body.topic}`,
      data: { consultationId: consult.id, type: 'consultation_requested' },
    });

    return { ...consult, agora: liveAgora };
  }

  async meeting(user: AuthUser, id: string) {
    const consult = await this.prisma.consultation.findUnique({
      where: { id },
    });
    if (!consult) throw new NotFoundException('Consultation not found');
    if (
      consult.coachId !== user.id &&
      consult.clientId !== user.id &&
      user.role !== 'ADMIN'
    ) {
      throw new ForbiddenException();
    }
    const agora = this.agora.meetingFor(id);
    return {
      consultationId: id,
      meetingUrl: consult.meetingUrl ?? agora.meetingUrl,
      status: consult.status,
      agora,
    };
  }

  async updateStatus(user: AuthUser, id: string, status: ConsultationStatus) {
    const consult = await this.prisma.consultation.findUnique({
      where: { id },
    });
    if (!consult) throw new NotFoundException('Consultation not found');
    if (consult.coachId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException();
    }

    const updated = await this.prisma.consultation.update({
      where: { id },
      data: { status },
      include: { coach: true, client: true, payment: true },
    });

    await this.notifications.pushToUser(consult.clientId, {
      title: 'Consultation update',
      body: `Your consult is now ${status.toLowerCase()}.`,
      data: {
        consultationId: id,
        status: String(status),
        type: 'consultation_status',
      },
    });

    return { ...updated, agora: this.agora.meetingFor(id) };
  }

  async pay(user: AuthUser, id: string) {
    const consult = await this.prisma.consultation.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!consult) throw new NotFoundException('Consultation not found');
    if (consult.clientId !== user.id) throw new ForbiddenException();

    const order = await this.razorpay.createOrder(
      consult.amountInr,
      consult.id,
    );

    const payment = await this.prisma.payment.upsert({
      where: { consultationId: id },
      update: {
        status:
          order.mode === 'demo' ? PaymentStatus.PAID : PaymentStatus.PENDING,
        externalId: order.orderId,
        amountInr: consult.amountInr,
      },
      create: {
        userId: user.id,
        consultationId: id,
        provider: 'razorpay',
        amountInr: consult.amountInr,
        currency: 'INR',
        status:
          order.mode === 'demo' ? PaymentStatus.PAID : PaymentStatus.PENDING,
        externalId: order.orderId,
      },
    });

    let updated = consult;
    if (order.mode === 'demo') {
      updated = await this.prisma.consultation.update({
        where: { id },
        data: { status: ConsultationStatus.SCHEDULED },
        include: { coach: true, client: true, payment: true },
      });
      await this.notifications.pushToUser(consult.coachId, {
        title: 'Consultation paid',
        body: `Payment ${order.orderId} received for ${consult.topic}.`,
        data: {
          consultationId: id,
          externalId: order.orderId,
          type: 'payment_paid',
        },
      });
    }

    const agora = this.agora.meetingFor(id);

    return {
      consultation: updated,
      payment,
      razorpay: order,
      agora,
    };
  }

  /** Confirm live Razorpay checkout after client-side success. */
  async confirmPayment(
    user: AuthUser,
    id: string,
    body: { razorpayOrderId?: string; razorpayPaymentId?: string },
  ) {
    const consult = await this.prisma.consultation.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!consult) throw new NotFoundException('Consultation not found');
    if (consult.clientId !== user.id) throw new ForbiddenException();

    const externalId =
      body.razorpayOrderId ??
      consult.payment?.externalId ??
      body.razorpayPaymentId;
    if (!externalId) throw new NotFoundException('Payment order missing');

    await this.prisma.payment.upsert({
      where: { consultationId: id },
      update: {
        status: PaymentStatus.PAID,
        externalId,
      },
      create: {
        userId: user.id,
        consultationId: id,
        provider: 'razorpay',
        amountInr: consult.amountInr,
        currency: 'INR',
        status: PaymentStatus.PAID,
        externalId,
      },
    });

    const updated = await this.prisma.consultation.update({
      where: { id },
      data: { status: ConsultationStatus.SCHEDULED },
      include: { coach: true, client: true, payment: true },
    });

    await this.notifications.pushToUser(consult.coachId, {
      title: 'Consultation paid',
      body: `Payment confirmed for ${consult.topic}.`,
      data: { consultationId: id, type: 'payment_paid' },
    });

    return {
      consultation: updated,
      agora: this.agora.meetingFor(id),
    };
  }

  async markPaidByExternalId(externalId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { externalId },
      include: { consultation: true },
    });
    if (!payment?.consultationId) return null;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.PAID },
    });
    return this.prisma.consultation.update({
      where: { id: payment.consultationId },
      data: { status: ConsultationStatus.SCHEDULED },
      include: { payment: true },
    });
  }
}
