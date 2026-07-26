import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { WorkoutsService } from '../workouts/workouts.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { RecoveryService } from '../recovery/recovery.service';
import { ProgressService } from '../progress/progress.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workouts: WorkoutsService,
    private readonly nutrition: NutritionService,
    private readonly recovery: RecoveryService,
    private readonly progress: ProgressService,
  ) {}

  async getToday(user: AuthUser) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { profile: true },
    });

    const firstName =
      full?.displayName?.split(' ')[0] ??
      full?.email?.split('@')[0] ??
      'Athlete';

    const [mine, fuel, recover, photoCount, latestPhoto] = await Promise.all([
      this.workouts.myWorkouts(user),
      this.nutrition.today(user),
      this.recovery.today(user),
      this.progress.countForUser(user.id),
      this.progress.latestForUser(user.id),
    ]);

    const workoutSubtitle = mine.todaySession
      ? `${mine.todaySession.title} · ${mine.todaySession.status.toLowerCase()}`
      : mine.assignments[0]
        ? `Program: ${mine.assignments[0].program.title}`
        : 'Browse programs in Train';

    const progressSubtitle =
      photoCount === 0
        ? 'Log your first check-in photo'
        : latestPhoto
          ? `${photoCount} photos · last ${latestPhoto.pose} ${latestPhoto.takenAt.toISOString().slice(0, 10)}`
          : `${photoCount} photos`;

    return {
      greeting: `Hello, ${firstName}`,
      date: new Date().toISOString().slice(0, 10),
      profileComplete: Boolean(full?.profile?.onboardingComplete),
      cards: [
        {
          id: 'workout',
          title: 'Train',
          subtitle: workoutSubtitle,
          status: mine.todaySession ? 'ready' : 'idle',
          phase: 2,
          meta: {
            sessionId: mine.todaySession?.id ?? null,
            programTitle: mine.assignments[0]?.program.title ?? null,
          },
        },
        {
          id: 'nutrition',
          title: 'Fuel',
          subtitle: `${Math.round(fuel.totals.calories)} / ${fuel.target.calories} kcal today`,
          status: 'ready',
          phase: 3,
          meta: { totals: fuel.totals, target: fuel.target },
        },
        {
          id: 'recovery',
          title: 'Recover',
          subtitle: `${recover.sleepHours ?? '—'}h sleep · score ${recover.recoveryScore ?? '—'} · ${recover.steps ?? 0} steps`,
          status: 'ready',
          phase: 4,
          meta: {
            stressScore: recover.stressScore,
            restingHr: recover.restingHr,
            recoveryScore: recover.recoveryScore,
            source: recover.source,
          },
        },
        {
          id: 'coach',
          title: 'Coach',
          subtitle: 'Chat · consults · Razorpay demo payments',
          status: 'ready',
          phase: 5,
        },
        {
          id: 'progress',
          title: 'Progress',
          subtitle: progressSubtitle,
          status: photoCount > 0 ? 'ready' : 'idle',
          phase: 2,
          meta: {
            count: photoCount,
            latestUrl: latestPhoto?.fileUrl ?? null,
          },
        },
        {
          id: 'ai',
          title: 'AI Health',
          subtitle: 'Insights · blood reports · biological age',
          status: 'ready',
          phase: 6,
        },
      ],
      goals: full?.profile?.goals ?? [],
      weightKg: full?.profile?.weightKg ?? null,
    };
  }
}
