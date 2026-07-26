import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

type RawExercise = {
  id: string;
  name: string;
  force?: string | null;
  level?: string | null;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string | null;
  images?: string[];
};

type PickedExercise = { id: string; name: string };

/**
 * Prisma 7 + adapter: keep an explicit PrismaClient return type so TS/IDE
 * don't infer a narrowed ClientOptions that drops model delegates.
 */
function prisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL required');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter }) as PrismaClient;
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

async function main() {
  const db = prisma();
  console.log('Seeding 23PrimeFit…');

  // Multi-tenant foundation: internal workspace + SaaS plans
  const starterPlan = await db.plan.upsert({
    where: { code: 'starter' },
    update: { active: true },
    create: {
      code: 'starter',
      name: 'Starter',
      description: 'Trial-friendly plan for independent coaches',
      priceInrMonthly: 1999,
      clientSeatLimit: 25,
      aiInsightLimit: 200,
      storageMbLimit: 2048,
    },
  });
  await db.plan.upsert({
    where: { code: 'pro' },
    update: { active: true },
    create: {
      code: 'pro',
      name: 'Pro',
      description: 'Growing coaching businesses',
      priceInrMonthly: 4999,
      clientSeatLimit: 100,
      aiInsightLimit: 1000,
      storageMbLimit: 10240,
    },
  });

  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 10);
  const internalTenant = await db.tenant.upsert({
    where: { slug: 'primefit-internal' },
    update: { active: true, name: '23PrimeFit Internal' },
    create: {
      slug: 'primefit-internal',
      name: '23PrimeFit Internal',
      type: 'PRIMEFIT_INTERNAL',
      active: true,
      subscriptions: {
        create: {
          planId: starterPlan.id,
          status: 'ACTIVE',
          currentPeriodEnd: periodEnd,
        },
      },
    },
  });
  console.log(`Internal tenant: ${internalTenant.slug} (${internalTenant.id})`);

  const rawPath = join(__dirname, '..', 'data', 'exercises.json');
  const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as RawExercise[];
  console.log(`Loaded ${raw.length} exercises from free-exercise-db`);

  // Clear dependent workout data then exercises for idempotent reseed
  await db.workoutSession.deleteMany();
  await db.workoutAssignment.deleteMany();
  await db.workoutProgramItem.deleteMany();
  await db.workoutProgram.deleteMany();
  await db.nutritionLog.deleteMany();
  await db.mealPlanAssignment.deleteMany();
  await db.mealPlanItem.deleteMany();
  await db.mealPlan.deleteMany();
  await db.recipe.deleteMany();
  await db.foodItem.deleteMany();
  await db.recoverySnapshot.deleteMany();
  await db.wearableConnection.deleteMany();
  await db.message.deleteMany();
  await db.messageThread.deleteMany();
  await db.payment.deleteMany();
  await db.consultation.deleteMany();
  await db.appNotification.deleteMany();
  await db.aiInsight.deleteMany();
  await db.biologicalAgeSnapshot.deleteMany();
  await db.bloodReport.deleteMany();
  await db.progressPhoto.deleteMany();
  await db.clientInvitation.deleteMany();
  await db.coachClient.deleteMany();
  await db.exercise.deleteMany();

  const batchSize = 100;
  for (let i = 0; i < raw.length; i += batchSize) {
    const slice = raw.slice(i, i + batchSize);
    await db.exercise.createMany({
      data: slice.map((e) => ({
        id: e.id,
        name: e.name,
        force: e.force ?? null,
        level: e.level ?? null,
        mechanic: e.mechanic ?? null,
        equipment: e.equipment ?? null,
        primaryMuscles: e.primaryMuscles ?? [],
        secondaryMuscles: e.secondaryMuscles ?? [],
        instructions: e.instructions ?? [],
        category: e.category ?? null,
        images: e.images ?? [],
        imageBaseUrl: IMAGE_BASE,
      })),
      skipDuplicates: true,
    });
    process.stdout.write(`\rExercises ${Math.min(i + batchSize, raw.length)}/${raw.length}`);
  }
  console.log('\nExercises seeded');

  const byName = async (name: string) => {
    const found = await db.exercise.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (!found) {
      const fuzzy = await db.exercise.findFirst({
        where: { name: { contains: name.split(' ')[0], mode: 'insensitive' } },
      });
      if (!fuzzy) throw new Error(`Exercise not found: ${name}`);
      return fuzzy;
    }
    return found;
  };

  // Prefer well-known names from free-exercise-db; fall back to category picks
  async function pick(
    preferred: string[],
    fallbackCategory: string,
    count: number,
  ): Promise<PickedExercise[]> {
    const picked: PickedExercise[] = [];
    for (const name of preferred) {
      try {
        const ex = await byName(name);
        if (!picked.find((p) => p.id === ex.id)) picked.push(ex);
      } catch {
        /* try next */
      }
      if (picked.length >= count) return picked;
    }
    const more = await db.exercise.findMany({
      where: { category: fallbackCategory },
      take: count * 2,
    });
    for (const ex of more) {
      if (!picked.find((p) => p.id === ex.id)) picked.push(ex);
      if (picked.length >= count) break;
    }
    if (picked.length < count) {
      const any = await db.exercise.findMany({ take: count });
      return any;
    }
    return picked;
  }

  const fullBodyDay1 = await pick(
    ['Barbell Squat', 'Bench Press', 'Bent Over Barbell Row', 'Plank'],
    'strength',
    4,
  );
  const fullBodyDay2 = await pick(
    [
      'Romanian Deadlift',
      'Dumbbell Shoulder Press',
      'Lat Pulldown',
      'Hanging Leg Raise',
    ],
    'strength',
    4,
  );
  const fatLoss = await pick(
    ['Burpee', 'Mountain Climbers', 'Kettlebell Swing', 'Jumping Jack', 'Air Bike'],
    'cardio',
    5,
  );
  const cricket = await pick(
    [
      'Medicine Ball Slam',
      'Lateral Bound',
      'Single-Leg Deadlift',
      'Cable Rotational Chop',
      'Sprint',
    ],
    'plyometrics',
    5,
  );

  const programs: Array<{
    slug: string;
    title: string;
    description: string;
    level: string;
    goalTags: string[];
    durationMin: number;
    daysPerWeek: number;
    days: PickedExercise[][];
  }> = [
    {
      slug: 'full-body-starter',
      title: 'Full Body Starter',
      description:
        'Three-session beginner program using open-source free-exercise-db movements.',
      level: 'beginner',
      goalTags: ['GENERAL_FITNESS', 'STRENGTH'],
      durationMin: 45,
      daysPerWeek: 3,
      days: [fullBodyDay1, fullBodyDay2, fullBodyDay1],
    },
    {
      slug: 'fat-loss-circuit',
      title: 'Fat Loss Circuit',
      description: 'Metabolic circuit for calorie burn and conditioning.',
      level: 'intermediate',
      goalTags: ['WEIGHT_LOSS', 'ENDURANCE'],
      durationMin: 30,
      daysPerWeek: 4,
      days: [fatLoss],
    },
    {
      slug: 'cricket-athletic-prep',
      title: 'Cricket Athletic Prep',
      description: 'Power, rotation, and single-leg work for cricket athletes.',
      level: 'intermediate',
      goalTags: ['CRICKET_PERFORMANCE', 'ATHLETIC_PERFORMANCE'],
      durationMin: 40,
      daysPerWeek: 3,
      days: [cricket],
    },
  ];

  const createdPrograms: Array<{ id: string; slug: string; title: string }> = [];
  for (const p of programs) {
    const program = await db.workoutProgram.create({
      data: {
        tenantId: internalTenant.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        level: p.level,
        goalTags: p.goalTags,
        durationMin: p.durationMin,
        daysPerWeek: p.daysPerWeek,
        items: {
          create: p.days.flatMap((day, dayIndex) =>
            day.map((ex, sortOrder) => ({
              exerciseId: ex.id,
              dayIndex,
              sortOrder,
              sets: p.slug === 'fat-loss-circuit' ? 3 : 3,
              reps: p.slug === 'fat-loss-circuit' ? '40s' : '8-12',
              restSec: p.slug === 'fat-loss-circuit' ? 30 : 75,
            })),
          ),
        },
      },
    });
    createdPrograms.push(program);
    console.log(`Program: ${program.title}`);
  }

  const foodDefs = [
      {
        name: 'Greek Yogurt',
        brand: 'Mock Dairy',
        servingLabel: '170g cup',
        calories: 100,
        proteinG: 17,
        carbsG: 6,
        fatG: 0.7,
        externalId: 'mock-greek-yogurt',
      },
      {
        name: 'Oatmeal with Banana',
        brand: 'Mock Kitchen',
        servingLabel: '1 bowl',
        calories: 320,
        proteinG: 10,
        carbsG: 58,
        fatG: 6,
        externalId: 'mock-oatmeal-banana',
      },
      {
        name: 'Grilled Chicken Bowl',
        brand: 'Mock Kitchen',
        servingLabel: '1 bowl',
        calories: 480,
        proteinG: 42,
        carbsG: 40,
        fatG: 14,
        externalId: 'mock-chicken-bowl',
      },
      {
        name: 'Mixed Salad + Paneer',
        brand: 'Mock Kitchen',
        servingLabel: '1 plate',
        calories: 390,
        proteinG: 24,
        carbsG: 18,
        fatG: 24,
        externalId: 'mock-paneer-salad',
      },
      {
        name: 'Whey Protein Shake',
        brand: 'Mock Fuel',
        servingLabel: '1 scoop + water',
        calories: 120,
        proteinG: 24,
        carbsG: 3,
        fatG: 1.5,
        externalId: 'mock-whey',
      },
      {
        name: 'Brown Rice + Dal',
        brand: 'Mock Kitchen',
        servingLabel: '1 plate',
        calories: 420,
        proteinG: 16,
        carbsG: 68,
        fatG: 8,
        externalId: 'mock-rice-dal',
      },
      {
        name: 'Apple',
        brand: null,
        servingLabel: '1 medium',
        calories: 95,
        proteinG: 0.5,
        carbsG: 25,
        fatG: 0.3,
        externalId: 'mock-apple',
      },
      {
        name: 'Almonds',
        brand: null,
        servingLabel: '20g handful',
        calories: 116,
        proteinG: 4,
        carbsG: 4,
        fatG: 10,
        externalId: 'mock-almonds',
      },
    ];
  const foods = await Promise.all(
    foodDefs.map((f) =>
      db.foodItem.create({
        data: {
          ...f,
          source: 'mock',
          isMock: true,
        },
      }),
    ),
  );
  console.log(`Foods: ${foods.length}`);

  const recipes = await Promise.all(
    [
      {
        slug: 'protein-oats',
        title: 'High-Protein Oats',
        summary: 'Warm oats with whey and banana for training mornings.',
        prepMin: 5,
        cookMin: 8,
        servings: 1,
        calories: 420,
        proteinG: 32,
        carbsG: 52,
        fatG: 9,
        tags: ['breakfast', 'high-protein', 'weight_loss'],
        ingredients: [
          '50g rolled oats',
          '1 scoop whey',
          '1 banana',
          '200ml milk or water',
          'Cinnamon',
        ],
        instructions: [
          'Cook oats in milk until creamy.',
          'Stir in whey off heat.',
          'Top with banana and cinnamon.',
        ],
      },
      {
        slug: 'grilled-chicken-bowl',
        title: 'Grilled Chicken Power Bowl',
        summary: 'Lean protein bowl with rice and greens.',
        prepMin: 15,
        cookMin: 20,
        servings: 1,
        calories: 520,
        proteinG: 45,
        carbsG: 48,
        fatG: 14,
        tags: ['lunch', 'strength', 'balanced'],
        ingredients: [
          '150g chicken breast',
          '120g cooked brown rice',
          'Mixed greens',
          'Olive oil drizzle',
          'Lemon + spices',
        ],
        instructions: [
          'Season and grill chicken.',
          'Plate with rice and greens.',
          'Finish with lemon and olive oil.',
        ],
      },
      {
        slug: 'paneer-veg-stirfry',
        title: 'Paneer Veg Stir-Fry',
        summary: 'Vegetarian dinner with paneer and colorful vegetables.',
        prepMin: 10,
        cookMin: 15,
        servings: 2,
        calories: 410,
        proteinG: 26,
        carbsG: 22,
        fatG: 24,
        tags: ['dinner', 'vegetarian', 'metabolic_health'],
        ingredients: [
          '150g paneer',
          'Bell peppers',
          'Broccoli',
          'Garlic',
          '1 tsp ghee or oil',
        ],
        instructions: [
          'Sauté garlic and vegetables.',
          'Add paneer cubes and spices.',
          'Cook until lightly browned.',
        ],
      },
      {
        slug: 'cricket-recovery-smoothie',
        title: 'Cricket Recovery Smoothie',
        summary: 'Post-session smoothie for athletes.',
        prepMin: 5,
        cookMin: 0,
        servings: 1,
        calories: 310,
        proteinG: 28,
        carbsG: 36,
        fatG: 6,
        tags: ['snack', 'cricket', 'recovery'],
        ingredients: [
          '1 scoop whey',
          '1 banana',
          'Handful spinach',
          '200ml milk',
          'Ice',
        ],
        instructions: ['Blend all ingredients until smooth.', 'Serve cold.'],
      },
    ].map((r) => db.recipe.create({ data: { ...r, source: 'seed' } })),
  );
  console.log(`Recipes: ${recipes.length}`);

  const metabolicPlan = await db.mealPlan.create({
    data: {
      tenantId: internalTenant.id,
      slug: 'metabolic-balance',
      title: 'Metabolic Balance Plan',
      description:
        'Coach-friendly 3-day meal rotation for fat loss and metabolic health.',
      goalTags: ['WEIGHT_LOSS', 'METABOLIC_HEALTH'],
      dailyKcal: 1800,
      items: {
        create: [
          {
            dayIndex: 0,
            mealType: 'breakfast',
            sortOrder: 0,
            recipeId: recipes[0].id,
          },
          {
            dayIndex: 0,
            mealType: 'lunch',
            sortOrder: 1,
            recipeId: recipes[1].id,
          },
          {
            dayIndex: 0,
            mealType: 'dinner',
            sortOrder: 2,
            recipeId: recipes[2].id,
          },
          {
            dayIndex: 1,
            mealType: 'breakfast',
            sortOrder: 0,
            recipeId: recipes[0].id,
          },
          {
            dayIndex: 1,
            mealType: 'snack',
            sortOrder: 1,
            recipeId: recipes[3].id,
          },
          {
            dayIndex: 1,
            mealType: 'dinner',
            sortOrder: 2,
            recipeId: recipes[2].id,
          },
          {
            dayIndex: 2,
            mealType: 'lunch',
            sortOrder: 0,
            recipeId: recipes[1].id,
          },
          {
            dayIndex: 2,
            mealType: 'snack',
            sortOrder: 1,
            recipeId: recipes[3].id,
          },
        ],
      },
    },
  });
  console.log(`Meal plan: ${metabolicPlan.title}`);

  // Attach mock plans to every existing CLIENT user
  const clients = await db.user.findMany({ where: { role: 'CLIENT' } });
  const demoCoach = await db.user.upsert({
    where: { firebaseUid: 'coach-demo' },
    update: { role: 'COACH', displayName: 'Coach Priya' },
    create: {
      firebaseUid: 'coach-demo',
      email: 'coach-demo@dev.local',
      displayName: 'Coach Priya',
      role: 'COACH',
      profile: { create: { onboardingComplete: true } },
    },
  });

  await db.tenantMembership.upsert({
    where: {
      tenantId_userId: { tenantId: internalTenant.id, userId: demoCoach.id },
    },
    update: { active: true, role: 'COACH' },
    create: {
      tenantId: internalTenant.id,
      userId: demoCoach.id,
      role: 'COACH',
    },
  });

  const starter = createdPrograms.find((p) => p.slug === 'full-body-starter')!;
  const today = new Date();
  const dateKey = todayKey(today);

  for (const client of clients) {
    await db.workoutAssignment.upsert({
      where: {
        userId_programId: { userId: client.id, programId: starter.id },
      },
      update: { active: true },
      create: { userId: client.id, programId: starter.id, active: true },
    });

    await db.coachClient.upsert({
      where: {
        tenantId_coachId_clientId: {
          tenantId: internalTenant.id,
          coachId: demoCoach.id,
          clientId: client.id,
        },
      },
      update: { active: true, notes: 'Seeded demo assignment' },
      create: {
        tenantId: internalTenant.id,
        coachId: demoCoach.id,
        clientId: client.id,
        notes: 'Seeded demo assignment',
      },
    });

    await db.clientMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId: internalTenant.id,
          userId: client.id,
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        tenantId: internalTenant.id,
        userId: client.id,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });

    await db.mealPlanAssignment.upsert({
      where: {
        userId_mealPlanId: {
          userId: client.id,
          mealPlanId: metabolicPlan.id,
        },
      },
      update: { active: true },
      create: {
        userId: client.id,
        mealPlanId: metabolicPlan.id,
        active: true,
      },
    });

    await db.workoutSession.deleteMany({ where: { userId: client.id } });
    await db.workoutSession.createMany({
      data: [
        {
          userId: client.id,
          programId: starter.id,
          title: `${starter.title} — Day 1`,
          dayIndex: 0,
          status: 'PLANNED',
          scheduledFor: today,
        },
        {
          userId: client.id,
          programId: starter.id,
          title: `${starter.title} — Day 2`,
          dayIndex: 1,
          status: 'PLANNED',
          scheduledFor: addDays(today, 2),
        },
        {
          userId: client.id,
          programId: starter.id,
          title: `${starter.title} — Day 3`,
          dayIndex: 2,
          status: 'PLANNED',
          scheduledFor: addDays(today, 4),
        },
      ],
    });

    await db.nutritionLog.deleteMany({
      where: { userId: client.id, dateKey },
    });
    await db.nutritionLog.createMany({
      data: [
        {
          userId: client.id,
          foodItemId: foods[1].id,
          mealType: 'breakfast',
          servings: 1,
          dateKey,
        },
        {
          userId: client.id,
          foodItemId: foods[2].id,
          mealType: 'lunch',
          servings: 1,
          dateKey,
        },
        {
          userId: client.id,
          foodItemId: foods[4].id,
          mealType: 'snack',
          servings: 1,
          dateKey,
        },
        {
          userId: client.id,
          foodItemId: foods[5].id,
          mealType: 'dinner',
          servings: 1,
          dateKey,
        },
      ],
    });

    for (let i = 0; i < 7; i++) {
      const d = addDays(today, -i);
      const key = todayKey(d);
      await db.recoverySnapshot.upsert({
        where: { userId_dateKey: { userId: client.id, dateKey: key } },
        update: {
          sleepHours: Math.round((6.6 + (i % 3) * 0.35) * 10) / 10,
          stressScore: 28 + i * 2,
          steps: 7000 + i * 380,
          restingHr: 56 + (i % 4),
          activeKcal: 360 + i * 30,
          hrvMs: 50 + i * 2,
          vo2Max: 41 + (i % 3),
          spo2: 96 + (i % 2),
          trainingLoad: 40 + i * 5,
          source: i === 0 ? 'health_connect' : 'mock',
          syncedAt: new Date(),
        },
        create: {
          userId: client.id,
          dateKey: key,
          sleepHours: Math.round((6.6 + (i % 3) * 0.35) * 10) / 10,
          stressScore: 28 + i * 2,
          steps: 7000 + i * 380,
          restingHr: 56 + (i % 4),
          activeKcal: 360 + i * 30,
          hrvMs: 50 + i * 2,
          vo2Max: 41 + (i % 3),
          spo2: 96 + (i % 2),
          trainingLoad: 40 + i * 5,
          source: i === 0 ? 'health_connect' : 'mock',
          syncedAt: new Date(),
        },
      });
    }

    await db.wearableConnection.upsert({
      where: {
        userId_provider: { userId: client.id, provider: 'health_connect' },
      },
      update: {
        status: 'connected',
        lastSyncAt: new Date(),
        deviceLabel: 'Pixel Watch',
      },
      create: {
        userId: client.id,
        provider: 'health_connect',
        status: 'connected',
        lastSyncAt: new Date(),
        deviceLabel: 'Pixel Watch',
      },
    });
  }

  // Ensure a demo athlete exists even if nobody logged in yet
  const demoAthlete = await db.user.upsert({
    where: { firebaseUid: 'athlete-23primefit-dev' },
    update: {},
    create: {
      firebaseUid: 'athlete-23primefit-dev',
      email: 'athlete@23primefit.dev',
      displayName: 'Asha Patel',
      role: 'CLIENT',
      profile: {
        create: {
          onboardingComplete: true,
          heightCm: 165,
          weightKg: 62,
          sex: 'FEMALE',
          activityLevel: 'MODERATE',
          goals: ['WEIGHT_LOSS', 'METABOLIC_HEALTH'],
          lifestyleDisorders: ['pcos'],
        },
      },
    },
  });

  await db.workoutAssignment.upsert({
    where: {
      userId_programId: {
        userId: demoAthlete.id,
        programId: starter.id,
      },
    },
    update: { active: true },
    create: { userId: demoAthlete.id, programId: starter.id },
  });
  await db.coachClient.upsert({
    where: {
      tenantId_coachId_clientId: {
        tenantId: internalTenant.id,
        coachId: demoCoach.id,
        clientId: demoAthlete.id,
      },
    },
    update: { active: true },
    create: {
      tenantId: internalTenant.id,
      coachId: demoCoach.id,
      clientId: demoAthlete.id,
    },
  });

  await db.clientMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: internalTenant.id,
        userId: demoAthlete.id,
      },
    },
    update: { status: 'ACTIVE' },
    create: {
      tenantId: internalTenant.id,
      userId: demoAthlete.id,
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });

  await db.mealPlanAssignment.upsert({
    where: {
      userId_mealPlanId: {
        userId: demoAthlete.id,
        mealPlanId: metabolicPlan.id,
      },
    },
    update: { active: true },
    create: {
      userId: demoAthlete.id,
      mealPlanId: metabolicPlan.id,
      active: true,
    },
  });

  const existingSessions = await db.workoutSession.count({
    where: { userId: demoAthlete.id },
  });
  if (existingSessions === 0) {
    await db.workoutSession.createMany({
      data: [
        {
          userId: demoAthlete.id,
          programId: starter.id,
          title: `${starter.title} — Day 1`,
          dayIndex: 0,
          status: 'PLANNED',
          scheduledFor: today,
        },
        {
          userId: demoAthlete.id,
          programId: starter.id,
          title: `${starter.title} — Day 2`,
          dayIndex: 1,
          status: 'PLANNED',
          scheduledFor: addDays(today, 2),
        },
      ],
    });
  }

  await db.nutritionLog.deleteMany({
    where: { userId: demoAthlete.id, dateKey },
  });
  await db.nutritionLog.createMany({
    data: [
      {
        userId: demoAthlete.id,
        foodItemId: foods[0].id,
        mealType: 'breakfast',
        servings: 1,
        dateKey,
      },
      {
        userId: demoAthlete.id,
        foodItemId: foods[2].id,
        mealType: 'lunch',
        servings: 1,
        dateKey,
      },
      {
        userId: demoAthlete.id,
        foodItemId: foods[6].id,
        mealType: 'snack',
        servings: 1,
        dateKey,
      },
      {
        userId: demoAthlete.id,
        foodItemId: foods[3].id,
        mealType: 'dinner',
        servings: 1,
        dateKey,
      },
    ],
  });

  for (let i = 0; i < 7; i++) {
    const d = addDays(today, -i);
    const key = todayKey(d);
    await db.recoverySnapshot.upsert({
      where: { userId_dateKey: { userId: demoAthlete.id, dateKey: key } },
      update: {
        sleepHours: Math.round((7.0 + (i % 3) * 0.3) * 10) / 10,
        stressScore: 24 + i * 2,
        steps: 8200 + i * 350,
        restingHr: 54 + (i % 3),
        activeKcal: 420 + i * 25,
        hrvMs: 58 + i * 2,
        vo2Max: 43 + (i % 3),
        spo2: 97,
        trainingLoad: 45 + i * 4,
        source: i === 0 ? 'apple_health' : 'mock',
        syncedAt: new Date(),
      },
      create: {
        userId: demoAthlete.id,
        dateKey: key,
        sleepHours: Math.round((7.0 + (i % 3) * 0.3) * 10) / 10,
        stressScore: 24 + i * 2,
        steps: 8200 + i * 350,
        restingHr: 54 + (i % 3),
        activeKcal: 420 + i * 25,
        hrvMs: 58 + i * 2,
        vo2Max: 43 + (i % 3),
        spo2: 97,
        trainingLoad: 45 + i * 4,
        source: i === 0 ? 'apple_health' : 'mock',
        syncedAt: new Date(),
      },
    });
  }

  await db.wearableConnection.upsert({
    where: {
      userId_provider: {
        userId: demoAthlete.id,
        provider: 'apple_health',
      },
    },
    update: {
      status: 'connected',
      lastSyncAt: new Date(),
      deviceLabel: 'Apple Watch',
    },
    create: {
      userId: demoAthlete.id,
      provider: 'apple_health',
      status: 'connected',
      lastSyncAt: new Date(),
      deviceLabel: 'Apple Watch',
    },
  });

  const thread = await db.messageThread.upsert({
    where: {
      coachId_clientId: {
        coachId: demoCoach.id,
        clientId: demoAthlete.id,
      },
    },
    update: {},
    create: {
      coachId: demoCoach.id,
      clientId: demoAthlete.id,
      subject: 'Coaching chat',
    },
  });

  await db.message.createMany({
    data: [
      {
        threadId: thread.id,
        senderId: demoCoach.id,
        body: 'Welcome to 23PrimeFit! I assigned Full Body Starter and Metabolic Balance.',
      },
      {
        threadId: thread.id,
        senderId: demoAthlete.id,
        body: 'Thanks Coach Priya — starting Day 1 today.',
      },
      {
        threadId: thread.id,
        senderId: demoCoach.id,
        body: 'Great. Log meals after training and sync your wearable tonight.',
      },
    ],
  });

  const consultAt = addDays(today, 2);
  consultAt.setHours(10, 0, 0, 0);
  await db.consultation.create({
    data: {
      coachId: demoCoach.id,
      clientId: demoAthlete.id,
      topic: 'Metabolic health check-in',
      notes: 'Review sleep, PCOS-aware nutrition, and cricket prep load.',
      scheduledAt: consultAt,
      durationMin: 30,
      status: 'SCHEDULED',
      meetingUrl: 'https://meet.23primefit.local/agora/demo01',
      amountInr: 999,
      payment: {
        create: {
          userId: demoAthlete.id,
          provider: 'razorpay',
          amountInr: 999,
          currency: 'INR',
          status: 'PAID',
          externalId: 'order_rzp_demo_seed01',
        },
      },
    },
  });

  await db.appNotification.createMany({
    data: [
      {
        userId: demoAthlete.id,
        title: 'Consultation scheduled',
        body: 'Metabolic health check-in in 2 days via Agora demo room.',
        type: 'consultation_status',
      },
      {
        userId: demoCoach.id,
        title: 'Client message',
        body: 'Thanks Coach Priya — starting Day 1 today.',
        type: 'chat_message',
      },
    ],
  });

  await db.bloodReport.create({
    data: {
      userId: demoAthlete.id,
      title: 'Metabolic panel',
      fileName: 'metabolic-panel-demo.pdf',
      fileUrl: 'https://files.23primefit.local/reports/demo-panel.pdf',
      markersJson: JSON.stringify({
        hba1c: 5.8,
        fastingGlucose: 108,
        ldl: 142,
        hdl: 48,
        triglycerides: 165,
        crp: 2.4,
        vitaminD: 28,
      }),
      summary:
        'HbA1c suggests impaired glucose control. LDL is above optimal range. Vitamin D is insufficient.',
      analyzedAt: new Date(),
    },
  });

  await db.biologicalAgeSnapshot.create({
    data: {
      userId: demoAthlete.id,
      chronologicalAge: 32,
      biologicalAge: 34.2,
      deltaYears: 2.2,
      factorsJson: JSON.stringify([
        { key: 'hba1c', impact: 1.8, note: 'HbA1c in prediabetes range' },
        { key: 'ldl', impact: 1.1, note: 'Elevated LDL' },
        { key: 'sleep', impact: -0.7, note: 'Decent sleep offset' },
      ]),
    },
  });

  await db.aiInsight.createMany({
    data: [
      {
        userId: demoAthlete.id,
        category: 'metabolic',
        title: 'Metabolic-aware meal timing',
        body: 'Prioritize protein + fiber at breakfast and walk after larger meals.',
        severity: 'info',
        source: 'rules',
      },
      {
        userId: demoAthlete.id,
        category: 'blood',
        title: 'LDL attention flag',
        body: 'Latest report LDL is 142. Emphasize fiber and coach review.',
        severity: 'alert',
        source: 'rules',
      },
    ],
  });

  await db.progressPhoto.deleteMany({ where: { userId: demoAthlete.id } });
  const { mkdir, writeFile } = await import('fs/promises');
  const { createHash, randomUUID } = await import('crypto');
  const storageRoot =
    process.env.STORAGE_LOCAL_ROOT ?? join(process.cwd(), 'uploads');
  const publicBase =
    process.env.STORAGE_PUBLIC_BASE_URL ??
    'http://127.0.0.1:3001/api/media';
  const pose = 'front';
  const label = new Date().toISOString().slice(0, 10);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
  <rect width="480" height="640" fill="#1B3A2F"/>
  <text x="240" y="300" text-anchor="middle" fill="#C8F560" font-family="Arial" font-size="40">FRONT</text>
  <text x="240" y="360" text-anchor="middle" fill="#E8EFE9" font-family="Arial" font-size="20">${label}</text>
</svg>`;
  const hash = createHash('sha1').update(randomUUID()).digest('hex').slice(0, 8);
  const storageKey = `progress/${hash}-front-seed.svg`;
  await mkdir(join(storageRoot, 'progress'), { recursive: true });
  await writeFile(join(storageRoot, storageKey), svg, 'utf8');
  await db.progressPhoto.create({
    data: {
      userId: demoAthlete.id,
      pose,
      caption: 'Seeded baseline check-in',
      weightKg: 78.5,
      storageKey,
      fileUrl: `${publicBase}/${storageKey}`,
      contentType: 'image/svg+xml',
      takenAt: new Date(),
    },
  });

  console.log('Seed complete.');
  console.log(`Demo athlete: ${demoAthlete.email} / firebaseUid ${demoAthlete.firebaseUid}`);
  console.log(`Demo coach: ${demoCoach.email}`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
