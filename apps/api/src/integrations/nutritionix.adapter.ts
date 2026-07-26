import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RemoteFood = {
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
};

@Injectable()
export class NutritionixAdapter {
  private readonly logger = new Logger(NutritionixAdapter.name);

  constructor(private readonly config: ConfigService) {}

  get enabled() {
    return Boolean(
      this.config.get<string>('NUTRITIONIX_APP_ID')?.trim() &&
        this.config.get<string>('NUTRITIONIX_APP_KEY')?.trim(),
    );
  }

  async search(q: string): Promise<RemoteFood[]> {
    if (!this.enabled || !q.trim()) return [];
    const appId = this.config.get<string>('NUTRITIONIX_APP_ID')!.trim();
    const appKey = this.config.get<string>('NUTRITIONIX_APP_KEY')!.trim();
    try {
      const res = await fetch(
        'https://trackapi.nutritionix.com/v2/search/instant',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-app-id': appId,
            'x-app-key': appKey,
          },
          body: JSON.stringify({ query: q.trim() }),
        },
      );
      if (!res.ok) {
        this.logger.warn(`Nutritionix search ${res.status}`);
        return [];
      }
      const data = (await res.json()) as {
        common?: Array<{ food_name?: string; serving_unit?: string; photo?: { thumb?: string } }>;
        branded?: Array<{
          nix_item_id?: string;
          food_name?: string;
          brand_name?: string;
          nf_calories?: number;
          serving_unit?: string;
          photo?: { thumb?: string };
        }>;
      };
      const branded = (data.branded ?? []).slice(0, 8).map((b) => ({
        externalId: b.nix_item_id ?? b.food_name ?? 'nx',
        name: b.food_name ?? 'Food',
        brand: b.brand_name,
        servingLabel: b.serving_unit ?? 'serving',
        calories: b.nf_calories ?? 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        imageUrl: b.photo?.thumb,
        source: 'nutritionix' as const,
      }));
      return branded;
    } catch (err) {
      this.logger.warn(`Nutritionix failed: ${String(err)}`);
      return [];
    }
  }
}
