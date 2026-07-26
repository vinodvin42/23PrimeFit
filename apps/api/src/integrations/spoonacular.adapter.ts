import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RemoteRecipe = {
  externalId: string;
  title: string;
  imageUrl?: string;
  readyInMinutes?: number;
  servings?: number;
  sourceUrl?: string;
};

@Injectable()
export class SpoonacularAdapter {
  private readonly logger = new Logger(SpoonacularAdapter.name);

  constructor(private readonly config: ConfigService) {}

  get enabled() {
    return Boolean(this.config.get<string>('SPOONACULAR_API_KEY')?.trim());
  }

  async searchRecipes(q: string): Promise<RemoteRecipe[]> {
    const key = this.config.get<string>('SPOONACULAR_API_KEY')?.trim();
    if (!key || !q.trim()) return [];
    try {
      const url =
        `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(q)}` +
        `&number=8&addRecipeInformation=true&apiKey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`Spoonacular ${res.status}`);
        return [];
      }
      const data = (await res.json()) as {
        results?: Array<{
          id: number;
          title: string;
          image?: string;
          readyInMinutes?: number;
          servings?: number;
          sourceUrl?: string;
        }>;
      };
      return (data.results ?? []).map((r) => ({
        externalId: String(r.id),
        title: r.title,
        imageUrl: r.image,
        readyInMinutes: r.readyInMinutes,
        servings: r.servings,
        sourceUrl: r.sourceUrl,
      }));
    } catch (err) {
      this.logger.warn(`Spoonacular failed: ${String(err)}`);
      return [];
    }
  }
}
