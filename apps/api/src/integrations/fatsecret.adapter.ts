import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RemoteFood } from './nutritionix.adapter';

/** FatSecret fallback when Nutritionix is down or unset. */
@Injectable()
export class FatSecretAdapter {
  private readonly logger = new Logger(FatSecretAdapter.name);

  constructor(private readonly config: ConfigService) {}

  get enabled() {
    return Boolean(
      this.config.get<string>('FATSECRET_CLIENT_ID')?.trim() &&
      this.config.get<string>('FATSECRET_CLIENT_SECRET')?.trim(),
    );
  }

  search(q: string): Promise<RemoteFood[]> {
    if (!this.enabled || !q.trim()) return Promise.resolve([]);
    // OAuth client-credentials + foods.search.v2 would go here.
    // Stub returns empty until credentials + token cache are wired.
    this.logger.debug(
      `FatSecret search stub for "${q}" — configure FATSECRET_* to enable`,
    );
    return Promise.resolve([]);
  }
}
