import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { TenantsService } from '../tenants/tenants.service';

export type ProgramInput = {
  title: string;
  description: string;
  level: string;
  goalTags?: string[];
  durationMin: number;
  daysPerWeek: number;
  active?: boolean;
  imageUrl?: string;
  videoUrl?: string;
  items?: Array<{
    exerciseId: string;
    dayIndex: number;
    sortOrder?: number;
    sets: number;
    reps: string;
    restSec?: number;
    notes?: string;
  }>;
};

export type MealPlanInput = {
  title: string;
  description: string;
  goalTags?: string[];
  dailyKcal: number;
  active?: boolean;
  imageUrl?: string;
  videoUrl?: string;
  items?: Array<{
    recipeId: string;
    dayIndex: number;
    mealType: string;
    sortOrder?: number;
  }>;
};

export type RecipeInput = {
  title: string;
  summary?: string;
  prepMin?: number;
  cookMin?: number;
  servings?: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  tags?: string[];
  ingredients?: string[];
  instructions?: string[];
  imageUrl?: string;
};

@Injectable()
export class CoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly tenants: TenantsService,
  ) {}

  private assertCoach(user: AuthUser) {
    if (user.role !== 'COACH' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Coach role required');
    }
  }

  private async assertOwnsClient(coachId: string, clientId: string) {
    const link = await this.prisma.coachClient.findFirst({
      where: { coachId, clientId, active: true },
    });
    if (!link) throw new NotFoundException('Client not found for this coach');
    return link;
  }

  /** Tenant-aware ownership check — denies cross-tenant client ids. */
  private async assertOwnsClientInTenant(
    coachId: string,
    clientId: string,
    tenantId: string,
  ) {
    const link = await this.prisma.coachClient.findFirst({
      where: { coachId, clientId, tenantId, active: true },
    });
    if (!link) {
      throw new ForbiddenException('Cross-tenant access denied');
    }
    return link;
  }

  private slugify(title: string) {
    const slug = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) throw new BadRequestException('A valid title is required');
    return slug;
  }

  private assertCanEdit(
    user: AuthUser,
    record: { createdById: string | null },
  ) {
    this.assertCoach(user);
    if (user.role !== 'ADMIN' && record.createdById !== user.id) {
      throw new ForbiddenException(
        'Only the creator or an admin can edit this content',
      );
    }
  }

  private validateProgram(body: ProgramInput) {
    if (
      !body.title?.trim() ||
      !body.description?.trim() ||
      !body.level?.trim()
    ) {
      throw new BadRequestException(
        'Title, description and level are required',
      );
    }
    if (body.durationMin < 5 || body.daysPerWeek < 1 || body.daysPerWeek > 7) {
      throw new BadRequestException(
        'Program duration or weekly frequency is invalid',
      );
    }
  }

  private validateMealPlan(body: MealPlanInput) {
    if (!body.title?.trim() || !body.description?.trim()) {
      throw new BadRequestException('Title and description are required');
    }
    if (body.dailyKcal < 500 || body.dailyKcal > 10000) {
      throw new BadRequestException(
        'Daily calories must be between 500 and 10000',
      );
    }
  }

  async listClients(coach: AuthUser) {
    this.assertCoach(coach);
    return this.prisma.coachClient.findMany({
      where: { coachId: coach.id, active: true },
      include: {
        client: { include: { profile: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateNotes(coach: AuthUser, clientId: string, notes: string) {
    this.assertCoach(coach);
    const link = await this.assertOwnsClient(coach.id, clientId);
    return this.prisma.coachClient.update({
      where: { id: link.id },
      data: { notes },
      include: { client: { include: { profile: true } } },
    });
  }

  async clientOverview(coach: AuthUser, clientId: string) {
    this.assertCoach(coach);
    const link = await this.assertOwnsClient(coach.id, clientId);
    const dateKey = new Date().toISOString().slice(0, 10);

    const [
      client,
      workout,
      mealPlan,
      recovery,
      recentMessages,
      progressPhotos,
      bloodReports,
      healthSignals,
      cricketLoad,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: clientId },
        include: { profile: true },
      }),
      this.prisma.workoutAssignment.findFirst({
        where: { userId: clientId, active: true },
        include: { program: true },
      }),
      this.prisma.mealPlanAssignment.findFirst({
        where: { userId: clientId, active: true },
        include: { mealPlan: true },
      }),
      this.prisma.recoverySnapshot.findUnique({
        where: { userId_dateKey: { userId: clientId, dateKey } },
      }),
      this.prisma.message.findMany({
        where: {
          thread: { coachId: coach.id, clientId },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { sender: true },
      }),
      this.prisma.progressPhoto.findMany({
        where: { userId: clientId },
        orderBy: { takenAt: 'desc' },
        take: 8,
      }),
      this.prisma.bloodReport.findMany({
        where: { userId: clientId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.healthSignal.findMany({
        where: { userId: clientId, dateKey },
      }),
      this.prisma.cricketSession.findMany({
        where: { userId: clientId },
        orderBy: { dateKey: 'desc' },
        take: 5,
      }),
    ]);

    return {
      link,
      client,
      workoutProgram: workout?.program ?? null,
      mealPlan: mealPlan?.mealPlan ?? null,
      recovery,
      recentMessages: recentMessages.reverse(),
      progressPhotos,
      bloodReports,
      healthSignals: healthSignals.map((s) => ({
        ...s,
        explain: JSON.parse(s.explainJson || '{}') as Record<string, unknown>,
      })),
      recentCricketSessions: cricketLoad,
    };
  }

  async assignWorkout(coach: AuthUser, clientId: string, slug: string) {
    this.assertCoach(coach);
    await this.assertOwnsClient(coach.id, clientId);
    const program = await this.prisma.workoutProgram.findUnique({
      where: { slug },
    });
    if (!program || !program.active)
      throw new NotFoundException('Program not found');

    await this.prisma.workoutAssignment.updateMany({
      where: { userId: clientId },
      data: { active: false },
    });

    const assignment = await this.prisma.workoutAssignment.upsert({
      where: {
        userId_programId: { userId: clientId, programId: program.id },
      },
      update: { active: true },
      create: { userId: clientId, programId: program.id, active: true },
      include: { program: true },
    });

    await this.prisma.workoutSession.create({
      data: {
        userId: clientId,
        programId: program.id,
        title: `${program.title} — Day 1`,
        dayIndex: 0,
        status: 'PLANNED',
        scheduledFor: new Date(),
      },
    });

    await this.notifications.pushToUser(clientId, {
      title: 'New workout program',
      body: `${coach.displayName ?? 'Your coach'} assigned ${program.title}.`,
      data: { type: 'workout_assigned', slug },
    });

    return assignment;
  }

  async assignMealPlan(coach: AuthUser, clientId: string, slug: string) {
    this.assertCoach(coach);
    await this.assertOwnsClient(coach.id, clientId);
    const plan = await this.prisma.mealPlan.findUnique({ where: { slug } });
    if (!plan || !plan.active)
      throw new NotFoundException('Meal plan not found');

    await this.prisma.mealPlanAssignment.updateMany({
      where: { userId: clientId },
      data: { active: false },
    });

    const assignment = await this.prisma.mealPlanAssignment.upsert({
      where: {
        userId_mealPlanId: { userId: clientId, mealPlanId: plan.id },
      },
      update: { active: true },
      create: { userId: clientId, mealPlanId: plan.id, active: true },
      include: { mealPlan: true },
    });

    await this.notifications.pushToUser(clientId, {
      title: 'New nutrition plan',
      body: `${coach.displayName ?? 'Your coach'} assigned ${plan.title}.`,
      data: { type: 'meal_plan_assigned', slug },
    });

    return assignment;
  }

  catalog() {
    return Promise.all([
      this.prisma.workoutProgram.findMany({
        where: { active: true },
        orderBy: { title: 'asc' },
      }),
      this.prisma.mealPlan.findMany({
        where: { active: true },
        orderBy: { title: 'asc' },
      }),
    ]).then(([programs, mealPlans]) => ({ programs, mealPlans }));
  }

  cmsCatalog(user: AuthUser) {
    this.assertCoach(user);
    const ownership =
      user.role === 'ADMIN' ? undefined : { createdById: user.id };
    return Promise.all([
      this.prisma.workoutProgram.findMany({
        where: ownership,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { items: true, assignments: true } } },
      }),
      this.prisma.mealPlan.findMany({
        where: ownership,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { items: true, assignments: true } } },
      }),
    ]).then(([programs, mealPlans]) => ({ programs, mealPlans }));
  }

  async cmsAssets(user: AuthUser, query = '') {
    this.assertCoach(user);
    const q = query.trim();
    const [exercises, recipes] = await Promise.all([
      this.prisma.exercise.findMany({
        where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
        select: { id: true, name: true, category: true, equipment: true },
        orderBy: { name: 'asc' },
        take: 100,
      }),
      this.prisma.recipe.findMany({
        where: q ? { title: { contains: q, mode: 'insensitive' } } : undefined,
        select: { id: true, slug: true, title: true, calories: true },
        orderBy: { title: 'asc' },
        take: 100,
      }),
    ]);
    return { exercises, recipes };
  }

  async cmsProgram(user: AuthUser, id: string) {
    const program = await this.prisma.workoutProgram.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
          include: { exercise: true },
        },
      },
    });
    if (!program) throw new NotFoundException('Program not found');
    this.assertCanEdit(user, program);
    return program;
  }

  async cmsMealPlan(user: AuthUser, id: string) {
    const plan = await this.prisma.mealPlan.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
          include: { recipe: true },
        },
      },
    });
    if (!plan) throw new NotFoundException('Meal plan not found');
    this.assertCanEdit(user, plan);
    return plan;
  }

  async clientNutritionTargets(user: AuthUser, clientId: string) {
    this.assertCoach(user);
    if (user.role !== 'ADMIN') {
      await this.assertOwnsClient(user.id, clientId);
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    const [client, logs, assignment] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: clientId },
        include: { profile: true },
      }),
      this.prisma.nutritionLog.findMany({
        where: { userId: clientId, dateKey },
        include: { food: true },
      }),
      this.prisma.mealPlanAssignment.findFirst({
        where: { userId: clientId, active: true },
        include: { mealPlan: true },
      }),
    ]);
    if (!client) throw new NotFoundException('Client not found');

    const profile = client.profile;
    const age = profile?.dateOfBirth
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - profile.dateOfBirth.getTime()) /
              (365.2425 * 24 * 60 * 60 * 1000),
          ),
        )
      : null;
    const inputs = {
      age,
      sex: profile?.sex ?? null,
      heightCm: profile?.heightCm ?? null,
      weightKg: profile?.weightKg ?? null,
      activityLevel: profile?.activityLevel ?? null,
      goals: profile?.goals ?? [],
      lifestyleDisorders: profile?.lifestyleDisorders ?? [],
      onboardingComplete: profile?.onboardingComplete ?? false,
    };
    const missing = Object.entries({
      age: inputs.age,
      sex: inputs.sex,
      heightCm: inputs.heightCm,
      weightKg: inputs.weightKg,
      activityLevel: inputs.activityLevel,
    })
      .filter(([, value]) => value == null)
      .map(([key]) => key);

    const currentIntake = logs.reduce(
      (total, log) => ({
        calories: total.calories + log.food.calories * log.servings,
        proteinG: total.proteinG + log.food.proteinG * log.servings,
        carbsG: total.carbsG + log.food.carbsG * log.servings,
        fatG: total.fatG + log.food.fatG * log.servings,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );

    if (missing.length) {
      return {
        client: {
          id: client.id,
          displayName: client.displayName,
          email: client.email,
        },
        inputs,
        missing,
        currentIntake,
        activeMealPlan: assignment?.mealPlan ?? null,
        targets: null,
        method: 'Mifflin-St Jeor',
      };
    }

    const activityFactors: Record<string, number> = {
      SEDENTARY: 1.2,
      LIGHT: 1.375,
      MODERATE: 1.55,
      ACTIVE: 1.725,
      VERY_ACTIVE: 1.9,
    };
    const sexAdjustment =
      inputs.sex === 'MALE' ? 5 : inputs.sex === 'FEMALE' ? -161 : -78;
    const bmr =
      10 * inputs.weightKg! +
      6.25 * inputs.heightCm! -
      5 * inputs.age! +
      sexAdjustment;
    const tdee = bmr * activityFactors[inputs.activityLevel!];
    const calorieAdjustment = inputs.goals.includes('WEIGHT_LOSS')
      ? -500
      : inputs.goals.includes('MUSCLE_GAIN')
        ? 300
        : inputs.goals.includes('ENDURANCE')
          ? 200
          : 0;
    const dailyCalories = Math.max(1200, Math.round(tdee + calorieAdjustment));
    const proteinMultiplier =
      inputs.goals.includes('MUSCLE_GAIN') ||
      inputs.goals.includes('ATHLETIC_PERFORMANCE') ||
      inputs.goals.includes('CRICKET_PERFORMANCE')
        ? 2
        : 1.6;
    const proteinG = Math.round(inputs.weightKg! * proteinMultiplier);
    const fatG = Math.round((dailyCalories * 0.25) / 9);
    const carbsG = Math.max(
      0,
      Math.round((dailyCalories - proteinG * 4 - fatG * 9) / 4),
    );

    return {
      client: {
        id: client.id,
        displayName: client.displayName,
        email: client.email,
      },
      inputs,
      missing,
      currentIntake,
      activeMealPlan: assignment?.mealPlan ?? null,
      targets: {
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        dailyCalories,
        proteinG,
        carbsG,
        fatG,
        calorieAdjustment,
        activityFactor: activityFactors[inputs.activityLevel!],
      },
      method: 'Mifflin-St Jeor',
    };
  }

  async uploadCmsMedia(
    user: AuthUser,
    body: {
      fileName: string;
      mimeType: string;
      dataBase64: string;
      kind: 'image' | 'video';
    },
  ) {
    this.assertCoach(user);
    const allowed =
      body.kind === 'image'
        ? ['image/jpeg', 'image/png', 'image/webp']
        : ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowed.includes(body.mimeType)) {
      throw new BadRequestException(`Unsupported ${body.kind} format`);
    }
    const encoded = body.dataBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(encoded, 'base64');
    if (!buffer.length || buffer.length > 20 * 1024 * 1024) {
      throw new BadRequestException('Media must be between 1 byte and 20 MB');
    }
    return this.storage.putObject({
      folder: `coach-content/${user.id}`,
      fileName: body.fileName,
      body: buffer,
      contentType: body.mimeType,
    });
  }

  async createRecipe(user: AuthUser, body: RecipeInput) {
    this.assertCoach(user);
    if (!body.title?.trim()) {
      throw new BadRequestException('Recipe title is required');
    }
    if (
      body.calories < 0 ||
      body.proteinG < 0 ||
      body.carbsG < 0 ||
      body.fatG < 0
    ) {
      throw new BadRequestException(
        'Recipe nutrition values cannot be negative',
      );
    }
    const baseSlug = this.slugify(body.title);
    const existing = await this.prisma.recipe.findUnique({
      where: { slug: baseSlug },
      select: { id: true },
    });
    const slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
    return this.prisma.recipe.create({
      data: {
        slug,
        title: body.title.trim(),
        summary: body.summary?.trim() || 'Coach-created recipe',
        imageUrl: body.imageUrl,
        prepMin: Math.max(0, body.prepMin ?? 10),
        cookMin: Math.max(0, body.cookMin ?? 15),
        servings: Math.max(1, body.servings ?? 1),
        calories: body.calories,
        proteinG: body.proteinG,
        carbsG: body.carbsG,
        fatG: body.fatG,
        tags: body.tags ?? [],
        ingredients: body.ingredients ?? [],
        instructions: body.instructions ?? [],
        source: `coach-cms:${user.id}`,
      },
    });
  }

  async createProgram(user: AuthUser, body: ProgramInput) {
    this.assertCoach(user);
    this.validateProgram(body);
    const baseSlug = this.slugify(body.title);
    const existing = await this.prisma.workoutProgram.findUnique({
      where: { slug: baseSlug },
      select: { id: true },
    });
    const slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
    const tenant = await this.tenants.ensureInternalTenant();
    const active = await this.tenants.resolveActiveTenant(user);
    return this.prisma.workoutProgram.create({
      data: {
        tenantId: active.tenant.id ?? tenant.id,
        slug,
        title: body.title.trim(),
        description: body.description.trim(),
        level: body.level.trim(),
        goalTags: body.goalTags ?? [],
        durationMin: body.durationMin,
        daysPerWeek: body.daysPerWeek,
        active: body.active ?? true,
        createdById: user.id,
        imageUrl: body.imageUrl,
        videoUrl: body.videoUrl,
        items: body.items?.length
          ? {
              create: body.items.map((item, index) => ({
                exerciseId: item.exerciseId,
                dayIndex: item.dayIndex,
                sortOrder: item.sortOrder ?? index,
                sets: item.sets,
                reps: item.reps,
                restSec: item.restSec ?? 60,
                notes: item.notes,
              })),
            }
          : undefined,
      },
      include: { _count: { select: { items: true, assignments: true } } },
    });
  }

  async updateProgram(user: AuthUser, id: string, body: ProgramInput) {
    this.validateProgram(body);
    const current = await this.prisma.workoutProgram.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Program not found');
    this.assertCanEdit(user, current);
    return this.prisma.$transaction(async (tx) => {
      if (body.items) {
        await tx.workoutProgramItem.deleteMany({ where: { programId: id } });
      }
      return tx.workoutProgram.update({
        where: { id },
        data: {
          title: body.title.trim(),
          description: body.description.trim(),
          level: body.level.trim(),
          goalTags: body.goalTags ?? [],
          durationMin: body.durationMin,
          daysPerWeek: body.daysPerWeek,
          active: body.active ?? current.active,
          imageUrl: body.imageUrl,
          videoUrl: body.videoUrl,
          items: body.items
            ? {
                create: body.items.map((item, index) => ({
                  exerciseId: item.exerciseId,
                  dayIndex: item.dayIndex,
                  sortOrder: item.sortOrder ?? index,
                  sets: item.sets,
                  reps: item.reps,
                  restSec: item.restSec ?? 60,
                  notes: item.notes,
                })),
              }
            : undefined,
        },
        include: { _count: { select: { items: true, assignments: true } } },
      });
    });
  }

  async archiveProgram(user: AuthUser, id: string) {
    const current = await this.prisma.workoutProgram.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Program not found');
    this.assertCanEdit(user, current);
    return this.prisma.workoutProgram.update({
      where: { id },
      data: { active: false },
    });
  }

  async createMealPlan(user: AuthUser, body: MealPlanInput) {
    this.assertCoach(user);
    this.validateMealPlan(body);
    const baseSlug = this.slugify(body.title);
    const existing = await this.prisma.mealPlan.findUnique({
      where: { slug: baseSlug },
      select: { id: true },
    });
    const slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
    const active = await this.tenants.resolveActiveTenant(user);
    return this.prisma.mealPlan.create({
      data: {
        tenantId: active.tenant.id,
        slug,
        title: body.title.trim(),
        description: body.description.trim(),
        goalTags: body.goalTags ?? [],
        dailyKcal: body.dailyKcal,
        active: body.active ?? true,
        createdById: user.id,
        imageUrl: body.imageUrl,
        videoUrl: body.videoUrl,
        items: body.items?.length
          ? {
              create: body.items.map((item, index) => ({
                recipeId: item.recipeId,
                dayIndex: item.dayIndex,
                mealType: item.mealType,
                sortOrder: item.sortOrder ?? index,
              })),
            }
          : undefined,
      },
      include: { _count: { select: { items: true, assignments: true } } },
    });
  }

  async updateMealPlan(user: AuthUser, id: string, body: MealPlanInput) {
    this.validateMealPlan(body);
    const current = await this.prisma.mealPlan.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Meal plan not found');
    this.assertCanEdit(user, current);
    return this.prisma.$transaction(async (tx) => {
      if (body.items) {
        await tx.mealPlanItem.deleteMany({ where: { mealPlanId: id } });
      }
      return tx.mealPlan.update({
        where: { id },
        data: {
          title: body.title.trim(),
          description: body.description.trim(),
          goalTags: body.goalTags ?? [],
          dailyKcal: body.dailyKcal,
          active: body.active ?? current.active,
          imageUrl: body.imageUrl,
          videoUrl: body.videoUrl,
          items: body.items
            ? {
                create: body.items.map((item, index) => ({
                  recipeId: item.recipeId,
                  dayIndex: item.dayIndex,
                  mealType: item.mealType,
                  sortOrder: item.sortOrder ?? index,
                })),
              }
            : undefined,
        },
        include: { _count: { select: { items: true, assignments: true } } },
      });
    });
  }

  async archiveMealPlan(user: AuthUser, id: string) {
    const current = await this.prisma.mealPlan.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Meal plan not found');
    this.assertCanEdit(user, current);
    return this.prisma.mealPlan.update({
      where: { id },
      data: { active: false },
    });
  }
}
