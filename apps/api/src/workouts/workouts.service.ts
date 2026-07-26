import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { ExerciseMediaAdapter } from '../integrations/exercise-media.adapter';

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: ExerciseMediaAdapter,
  ) {}

  mapExercise<T extends { id: string; images: string[]; imageBaseUrl: string }>(
    ex: T,
  ) {
    const filenames = ex.images.map((p) => p.replace(/^\//, ''));
    const urls = this.media.resolveImageUrls(
      ex.id,
      filenames.length ? filenames : ['0.jpg'],
    );
    const videoUrls = this.media.resolveVideoUrls(ex.id);
    return {
      ...ex,
      imageUrls: urls.length
        ? urls
        : ex.images.map(
            (path) =>
              `${ex.imageBaseUrl || 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'}${path}`,
          ),
      videoUrls,
      media: this.media.status(),
    };
  }

  async listExercises(opts: {
    q?: string;
    muscle?: string;
    category?: string;
    limit: number;
    offset: number;
  }) {
    const where = {
      AND: [
        opts.q
          ? { name: { contains: opts.q, mode: 'insensitive' as const } }
          : {},
        opts.category
          ? {
              category: {
                equals: opts.category,
                mode: 'insensitive' as const,
              },
            }
          : {},
        opts.muscle
          ? { primaryMuscles: { has: opts.muscle.toLowerCase() } }
          : {},
      ],
    };

    const [total, items] = await Promise.all([
      this.prisma.exercise.count({ where }),
      this.prisma.exercise.findMany({
        where,
        orderBy: { name: 'asc' },
        take: Math.min(opts.limit, 100),
        skip: opts.offset,
      }),
    ]);

    return {
      total,
      items: items.map((e) => this.mapExercise(e)),
      source: 'yuhonas/free-exercise-db (Unlicense)',
    };
  }

  async getExercise(id: string) {
    const ex = await this.prisma.exercise.findUnique({ where: { id } });
    return ex ? this.mapExercise(ex) : null;
  }

  listPrograms() {
    return this.prisma.workoutProgram.findMany({
      where: { active: true },
      orderBy: { title: 'asc' },
      include: { _count: { select: { items: true } } },
    });
  }

  getProgram(slug: string) {
    return this.prisma.workoutProgram
      .findUnique({
        where: { slug },
        include: {
          items: {
            orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
            include: { exercise: true },
          },
        },
      })
      .then((p) => {
        if (!p) return null;
        return {
          ...p,
          items: p.items.map((item) => ({
            ...item,
            exercise: this.mapExercise(item.exercise),
          })),
        };
      });
  }

  async ensureDemoAssignment(user: AuthUser) {
    const existing = await this.prisma.workoutAssignment.findFirst({
      where: { userId: user.id, active: true },
    });
    if (existing) return;

    const starter = await this.prisma.workoutProgram.findUnique({
      where: { slug: 'full-body-starter' },
    });
    if (!starter) return;

    await this.prisma.workoutAssignment.create({
      data: { userId: user.id, programId: starter.id, active: true },
    });

    const sessionCount = await this.prisma.workoutSession.count({
      where: { userId: user.id },
    });
    if (sessionCount === 0) {
      const today = new Date();
      await this.prisma.workoutSession.create({
        data: {
          userId: user.id,
          programId: starter.id,
          title: `${starter.title} — Day 1`,
          dayIndex: 0,
          status: 'PLANNED',
          scheduledFor: today,
        },
      });
    }
  }

  async myWorkouts(user: AuthUser) {
    await this.ensureDemoAssignment(user);

    const [assignments, sessions, programs] = await Promise.all([
      this.prisma.workoutAssignment.findMany({
        where: { userId: user.id, active: true },
        include: { program: true },
      }),
      this.prisma.workoutSession.findMany({
        where: { userId: user.id },
        orderBy: { scheduledFor: 'asc' },
        include: { program: true },
      }),
      this.prisma.workoutProgram.findMany({
        where: { active: true },
        orderBy: { title: 'asc' },
      }),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const todaySession =
      sessions.find(
        (s) =>
          s.scheduledFor.toISOString().slice(0, 10) === today &&
          s.status !== 'COMPLETED',
      ) ?? sessions.find((s) => s.status === 'PLANNED');

    return {
      assignments,
      sessions,
      todaySession,
      catalog: programs,
    };
  }

  async getSession(user: AuthUser, id: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id, userId: user.id },
      include: { program: true },
    });
    if (!session) return null;

    const items = session.programId
      ? await this.prisma.workoutProgramItem.findMany({
          where: {
            programId: session.programId,
            dayIndex: session.dayIndex,
          },
          orderBy: { sortOrder: 'asc' },
          include: { exercise: true },
        })
      : [];

    return {
      ...session,
      exercises: items.map((item) => ({
        ...item,
        exercise: this.mapExercise(item.exercise),
      })),
    };
  }

  async startSession(user: AuthUser, id: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id, userId: user.id },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'COMPLETED') {
      return session;
    }
    return this.prisma.workoutSession.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: session.startedAt ?? new Date(),
      },
    });
  }

  async completeSession(
    user: AuthUser,
    id: string,
    body: { perceivedEffort?: number; notes?: string },
  ) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id, userId: user.id },
    });
    if (!session) throw new NotFoundException('Session not found');

    const startedAt = session.startedAt ?? new Date();
    const durationMin = Math.max(
      1,
      Math.round((Date.now() - startedAt.getTime()) / 60000),
    );

    return this.prisma.workoutSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        startedAt,
        durationMin,
        perceivedEffort: body.perceivedEffort ?? 7,
        notes: body.notes,
      },
    });
  }

  async assignProgram(user: AuthUser, slug: string) {
    const program = await this.prisma.workoutProgram.findUnique({
      where: { slug },
    });
    if (!program) throw new NotFoundException('Program not found');

    await this.prisma.workoutAssignment.updateMany({
      where: { userId: user.id },
      data: { active: false },
    });

    const assignment = await this.prisma.workoutAssignment.upsert({
      where: {
        userId_programId: { userId: user.id, programId: program.id },
      },
      update: { active: true },
      create: { userId: user.id, programId: program.id, active: true },
    });

    const today = new Date();
    await this.prisma.workoutSession.create({
      data: {
        userId: user.id,
        programId: program.id,
        title: `${program.title} — Day 1`,
        dayIndex: 0,
        status: 'PLANNED',
        scheduledFor: today,
      },
    });

    return assignment;
  }
}
