import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { NutritionixAdapter } from '../integrations/nutritionix.adapter';
import { FatSecretAdapter } from '../integrations/fatsecret.adapter';
import { SpoonacularAdapter } from '../integrations/spoonacular.adapter';

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  image_front_small_url?: string;
  image_url?: string;
  nutriments?: Record<string, number | undefined>;
  serving_size?: string;
};

@Injectable()
export class NutritionService {
  private readonly logger = new Logger(NutritionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nutritionix: NutritionixAdapter,
    private readonly fatsecret: FatSecretAdapter,
    private readonly spoonacular: SpoonacularAdapter,
  ) {}

  listLocalFoods(q?: string) {
    return this.prisma.foodItem.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
      take: 50,
    });
  }

  async searchFoods(q: string) {
    const query = q.trim();
    if (!query) return { items: [], source: 'local' };

    const local = await this.prisma.foodItem.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { brand: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    let offItems: Awaited<ReturnType<NutritionService['upsertOffProduct']>>[] =
      [];
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': '23PrimeFit/0.1 (local-dev; nutrition-phase3)',
        },
      });
      if (res.ok) {
        const data = (await res.json()) as { products?: OffProduct[] };
        const products = (data.products ?? []).filter((p) => p.product_name);
        offItems = [];
        for (const p of products.slice(0, 8)) {
          try {
            offItems.push(await this.upsertOffProduct(p));
          } catch (err) {
            this.logger.warn(`OFF upsert skipped: ${String(err)}`);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Open Food Facts search failed: ${String(err)}`);
    }

    const nxItems: Awaited<ReturnType<NutritionService['upsertRemoteFood']>>[] =
      [];
    let nxSource = '';
    try {
      let remote = await this.nutritionix.search(query);
      nxSource = remote.length ? 'nutritionix' : '';
      if (!remote.length) {
        remote = await this.fatsecret.search(query);
        nxSource = remote.length ? 'fatsecret' : '';
      }
      for (const r of remote.slice(0, 8)) {
        try {
          nxItems.push(await this.upsertRemoteFood(r));
        } catch (err) {
          this.logger.warn(`Remote food upsert skipped: ${String(err)}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Licensed food search failed: ${String(err)}`);
    }

    const merged = [...local, ...nxItems, ...offItems].filter(
      (item, index, arr) => arr.findIndex((x) => x.id === item.id) === index,
    );

    const sources = [
      local.length ? 'local' : null,
      nxSource || null,
      offItems.length ? 'openfoodfacts' : null,
    ].filter(Boolean);

    return {
      items: merged,
      source: sources.join('+') || 'local',
    };
  }

  async lookupBarcode(barcode: string) {
    const code = barcode.replace(/\D/g, '');
    if (code.length < 8) {
      throw new BadRequestException('Barcode must be at least 8 digits');
    }

    const existing = await this.prisma.foodItem.findFirst({
      where: { barcode: code },
    });
    if (existing) return existing;

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json`,
      {
        headers: {
          'User-Agent': '23PrimeFit/0.1 (local-dev; nutrition-phase3)',
        },
      },
    );
    if (!res.ok) {
      throw new NotFoundException('Product not found on Open Food Facts');
    }
    const data = (await res.json()) as {
      status?: number;
      product?: OffProduct;
    };
    if (data.status !== 1 || !data.product) {
      throw new NotFoundException('Product not found on Open Food Facts');
    }
    return this.upsertOffProduct({ ...data.product, code });
  }

  private nutrients(p: OffProduct) {
    const n = p.nutriments ?? {};
    const calories =
      n['energy-kcal_serving'] ??
      n['energy-kcal_100g'] ??
      n['energy-kcal'] ??
      0;
    return {
      calories: Number(calories) || 0,
      proteinG: Number(n.proteins_serving ?? n.proteins_100g ?? 0) || 0,
      carbsG: Number(n.carbohydrates_serving ?? n.carbohydrates_100g ?? 0) || 0,
      fatG: Number(n.fat_serving ?? n.fat_100g ?? 0) || 0,
      servingLabel: p.serving_size || '100g / serving',
    };
  }

  private async upsertOffProduct(p: OffProduct) {
    const externalId = p.code || p.product_name || crypto.randomUUID();
    const macros = this.nutrients(p);
    return this.prisma.foodItem.upsert({
      where: {
        source_externalId: {
          source: 'openfoodfacts',
          externalId: String(externalId),
        },
      },
      update: {
        name: p.product_name || 'Unknown product',
        brand: p.brands || null,
        barcode: p.code || null,
        imageUrl: p.image_front_small_url || p.image_url || null,
        ...macros,
        isMock: false,
      },
      create: {
        name: p.product_name || 'Unknown product',
        brand: p.brands || null,
        barcode: p.code || null,
        imageUrl: p.image_front_small_url || p.image_url || null,
        source: 'openfoodfacts',
        externalId: String(externalId),
        isMock: false,
        ...macros,
      },
    });
  }

  private async upsertRemoteFood(r: {
    externalId: string;
    name: string;
    brand?: string;
    servingLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    imageUrl?: string;
    source: 'nutritionix' | 'fatsecret';
  }) {
    return this.prisma.foodItem.upsert({
      where: {
        source_externalId: {
          source: r.source,
          externalId: r.externalId,
        },
      },
      update: {
        name: r.name,
        brand: r.brand ?? null,
        servingLabel: r.servingLabel,
        calories: r.calories,
        proteinG: r.proteinG,
        carbsG: r.carbsG,
        fatG: r.fatG,
        imageUrl: r.imageUrl ?? null,
        isMock: false,
      },
      create: {
        name: r.name,
        brand: r.brand ?? null,
        servingLabel: r.servingLabel,
        calories: r.calories,
        proteinG: r.proteinG,
        carbsG: r.carbsG,
        fatG: r.fatG,
        imageUrl: r.imageUrl ?? null,
        source: r.source,
        externalId: r.externalId,
        isMock: false,
      },
    });
  }

  async ensureTodayMock(user: AuthUser) {
    const dateKey = new Date().toISOString().slice(0, 10);
    const count = await this.prisma.nutritionLog.count({
      where: { userId: user.id, dateKey },
    });
    if (count > 0) return;

    const foods = await this.prisma.foodItem.findMany({
      where: { source: 'mock' },
      take: 4,
    });
    if (foods.length < 4) return;

    const meals = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
    await this.prisma.nutritionLog.createMany({
      data: foods.slice(0, 4).map((f, i) => ({
        userId: user.id,
        foodItemId: f.id,
        mealType: meals[i],
        servings: 1,
        dateKey,
      })),
    });
  }

  async today(user: AuthUser) {
    await this.ensureTodayMock(user);
    const dateKey = new Date().toISOString().slice(0, 10);
    const [logs, assignment] = await Promise.all([
      this.prisma.nutritionLog.findMany({
        where: { userId: user.id, dateKey },
        include: { food: true },
        orderBy: { loggedAt: 'asc' },
      }),
      this.prisma.mealPlanAssignment.findFirst({
        where: { userId: user.id, active: true },
        include: {
          mealPlan: {
            include: {
              items: {
                where: { dayIndex: new Date().getDay() % 3 },
                include: { recipe: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      }),
    ]);

    const totals = logs.reduce(
      (acc, log) => {
        const s = log.servings;
        acc.calories += log.food.calories * s;
        acc.proteinG += log.food.proteinG * s;
        acc.carbsG += log.food.carbsG * s;
        acc.fatG += log.food.fatG * s;
        return acc;
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );

    const targetCalories = assignment?.mealPlan.dailyKcal ?? 2000;

    return {
      dateKey,
      target: {
        calories: targetCalories,
        proteinG: Math.round((targetCalories * 0.3) / 4),
        carbsG: Math.round((targetCalories * 0.4) / 4),
        fatG: Math.round((targetCalories * 0.3) / 9),
      },
      totals,
      logs,
      mealPlan: assignment?.mealPlan ?? null,
      source: 'mock+openfoodfacts',
    };
  }

  private hydrationTargetMl(user: AuthUser) {
    const weightKg = user.profile?.weightKg;
    if (weightKg && weightKg > 0) {
      return Math.round(weightKg * 33);
    }
    return 2500;
  }

  async hydrationToday(user: AuthUser) {
    const dateKey = new Date().toISOString().slice(0, 10);
    const logs = await this.prisma.hydrationLog.findMany({
      where: { userId: user.id, dateKey },
      orderBy: { loggedAt: 'asc' },
    });
    const totalMl = logs.reduce((sum, log) => sum + log.amountMl, 0);
    return {
      dateKey,
      totalMl,
      targetMl: this.hydrationTargetMl(user),
      logs,
    };
  }

  async logHydration(user: AuthUser, amountMl: number) {
    if (!Number.isFinite(amountMl) || amountMl <= 0) {
      throw new BadRequestException('amountMl must be a positive number');
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    return this.prisma.hydrationLog.create({
      data: { userId: user.id, amountMl: Math.round(amountMl), dateKey },
    });
  }

  async hydrationHistory(user: AuthUser, days = 7) {
    const from = new Date(Date.now() - days * 86400000)
      .toISOString()
      .slice(0, 10);
    const logs = await this.prisma.hydrationLog.findMany({
      where: { userId: user.id, dateKey: { gte: from } },
      orderBy: { dateKey: 'asc' },
    });
    const byDate = new Map<string, number>();
    for (const log of logs) {
      byDate.set(log.dateKey, (byDate.get(log.dateKey) ?? 0) + log.amountMl);
    }
    return {
      targetMl: this.hydrationTargetMl(user),
      days: Array.from(byDate.entries()).map(([dateKey, totalMl]) => ({
        dateKey,
        totalMl,
      })),
    };
  }

  async addLog(
    user: AuthUser,
    body: { foodItemId: string; mealType: string; servings?: number },
  ) {
    const dateKey = new Date().toISOString().slice(0, 10);
    return this.prisma.nutritionLog.create({
      data: {
        userId: user.id,
        foodItemId: body.foodItemId,
        mealType: body.mealType,
        servings: body.servings ?? 1,
        dateKey,
      },
      include: { food: true },
    });
  }

  async deleteLog(user: AuthUser, id: string) {
    const log = await this.prisma.nutritionLog.findFirst({
      where: { id, userId: user.id },
    });
    if (!log) throw new NotFoundException('Log not found');
    await this.prisma.nutritionLog.delete({ where: { id } });
    return { ok: true };
  }

  async listRecipes(q?: string) {
    return this.prisma.recipe.findMany({
      where: q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { tags: { has: q.toLowerCase() } },
            ],
          }
        : undefined,
      orderBy: { title: 'asc' },
    });
  }

  async searchRemoteRecipes(q: string) {
    const items = await this.spoonacular.searchRecipes(q);
    if (items.length) {
      return {
        items,
        source: 'spoonacular',
        mode: this.spoonacular.enabled ? 'live' : 'empty',
      };
    }
    // Dev fallback: surface seeded recipes as "remote" so Fuel UI works without API key.
    const local = await this.prisma.recipe.findMany({
      where: q.trim()
        ? { title: { contains: q.trim(), mode: 'insensitive' } }
        : undefined,
      orderBy: { title: 'asc' },
      take: 8,
    });
    return {
      items: local.map((r) => ({
        externalId: r.slug,
        title: r.title,
        imageUrl: r.imageUrl ?? undefined,
        readyInMinutes: r.prepMin + r.cookMin,
        servings: r.servings,
        sourceUrl: undefined,
        calories: r.calories,
        proteinG: r.proteinG,
        localSlug: r.slug,
      })),
      source: this.spoonacular.enabled ? 'spoonacular' : 'seed_fallback',
      mode: this.spoonacular.enabled ? 'live_empty' : 'demo',
    };
  }

  async importRemoteRecipe(
    user: AuthUser,
    body: {
      externalId: string;
      title: string;
      imageUrl?: string;
      readyInMinutes?: number;
      servings?: number;
      calories?: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      localSlug?: string;
    },
  ) {
    if (body.localSlug) {
      return this.getRecipe(body.localSlug);
    }
    const slug = `sp-${body.externalId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
    const existing = await this.prisma.recipe.findUnique({ where: { slug } });
    if (existing) return existing;

    const mins = body.readyInMinutes ?? 30;
    return this.prisma.recipe.create({
      data: {
        slug,
        title: body.title,
        summary: `Imported from Spoonacular (${body.externalId}) by ${user.displayName ?? user.id}`,
        imageUrl: body.imageUrl,
        prepMin: Math.max(5, Math.round(mins / 2)),
        cookMin: Math.max(5, Math.round(mins / 2)),
        servings: body.servings ?? 2,
        calories: body.calories ?? 400,
        proteinG: body.proteinG ?? 25,
        carbsG: body.carbsG ?? 40,
        fatG: body.fatG ?? 12,
        tags: ['spoonacular', 'imported'],
        ingredients: ['See Spoonacular source for full ingredient list'],
        instructions: [
          'Imported recipe shell — open source URL for full steps when available.',
        ],
        source: 'spoonacular',
      },
    });
  }

  async getRecipe(slug: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { slug } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    return recipe;
  }

  listMealPlans() {
    return this.prisma.mealPlan.findMany({
      where: { active: true },
      orderBy: { title: 'asc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async getMealPlan(slug: string) {
    const plan = await this.prisma.mealPlan.findUnique({
      where: { slug },
      include: {
        items: {
          orderBy: [{ dayIndex: 'asc' }, { sortOrder: 'asc' }],
          include: { recipe: true },
        },
      },
    });
    if (!plan) throw new NotFoundException('Meal plan not found');
    return plan;
  }

  async assignMealPlan(user: AuthUser, slug: string) {
    const plan = await this.prisma.mealPlan.findUnique({ where: { slug } });
    if (!plan) throw new NotFoundException('Meal plan not found');

    await this.prisma.mealPlanAssignment.updateMany({
      where: { userId: user.id },
      data: { active: false },
    });

    return this.prisma.mealPlanAssignment.upsert({
      where: {
        userId_mealPlanId: { userId: user.id, mealPlanId: plan.id },
      },
      update: { active: true },
      create: { userId: user.id, mealPlanId: plan.id, active: true },
      include: { mealPlan: true },
    });
  }

  async clientNutritionSummary(coach: AuthUser, clientId: string) {
    const link = await this.prisma.coachClient.findFirst({
      where: { coachId: coach.id, clientId, active: true },
    });
    if (!link && coach.role !== 'ADMIN') {
      throw new NotFoundException('Client not found for this coach');
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    const logs = await this.prisma.nutritionLog.findMany({
      where: { userId: clientId, dateKey },
      include: { food: true },
    });
    const totals = logs.reduce(
      (acc, log) => {
        acc.calories += log.food.calories * log.servings;
        acc.proteinG += log.food.proteinG * log.servings;
        return acc;
      },
      { calories: 0, proteinG: 0 },
    );
    const plan = await this.prisma.mealPlanAssignment.findFirst({
      where: { userId: clientId, active: true },
      include: { mealPlan: true },
    });
    return { dateKey, totals, logs, mealPlan: plan?.mealPlan ?? null };
  }
}
