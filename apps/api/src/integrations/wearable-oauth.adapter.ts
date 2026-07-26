import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export type OAuthStartResult = {
  provider: 'garmin' | 'whoop';
  mode: 'oauth' | 'stub';
  authorizeUrl: string;
  state: string;
};

/**
 * Garmin / WHOOP OAuth stubs.
 * Returns authorize URLs when client IDs are set; otherwise stub deep-links
 * so the mobile Recover UI can still exercise the connect flow.
 */
@Injectable()
export class WearableOauthAdapter {
  private readonly logger = new Logger(WearableOauthAdapter.name);

  constructor(private readonly config: ConfigService) {}

  start(provider: 'garmin' | 'whoop', userId: string): OAuthStartResult {
    const state = this.createState(provider, userId);

    if (provider === 'garmin') {
      const clientId = this.config.get<string>('GARMIN_CLIENT_ID')?.trim();
      const redirect =
        this.config.get<string>('GARMIN_REDIRECT_URI')?.trim() ||
        'https://api.23primefit.local/api/recovery/oauth/garmin/callback';
      if (clientId && this.config.get<string>('GARMIN_CLIENT_SECRET')?.trim()) {
        const authorizeUrl =
          `https://connect.garmin.com/oauthConfirm?client_id=${encodeURIComponent(clientId)}` +
          `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}` +
          `&state=${encodeURIComponent(state)}`;
        return { provider, mode: 'oauth', authorizeUrl, state };
      }
    }

    if (provider === 'whoop') {
      const clientId = this.config.get<string>('WHOOP_CLIENT_ID')?.trim();
      const redirect =
        this.config.get<string>('WHOOP_REDIRECT_URI')?.trim() ||
        'https://api.23primefit.local/api/recovery/oauth/whoop/callback';
      if (clientId && this.config.get<string>('WHOOP_CLIENT_SECRET')?.trim()) {
        const authorizeUrl =
          `https://api.prod.whoop.com/oauth/oauth2/auth?client_id=${encodeURIComponent(clientId)}` +
          `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}` +
          `&scope=${encodeURIComponent('read:recovery read:cycles read:sleep read:profile')}` +
          `&state=${encodeURIComponent(state)}`;
        return { provider, mode: 'oauth', authorizeUrl, state };
      }
    }

    if (!this.demoEnabled) {
      throw new ServiceUnavailableException(
        `${provider} OAuth is not configured. Set its client ID, client secret, redirect URI, and WEARABLE_OAUTH_STATE_SECRET.`,
      );
    }
    this.logger.warn(`${provider} OAuth not configured — demo mode enabled`);
    return {
      provider,
      mode: 'stub',
      authorizeUrl: `primefit://wearables/connect?provider=${provider}&state=${encodeURIComponent(state)}`,
      state,
    };
  }

  /** Exchange code for tokens — stores connection when secrets present; stub otherwise. */
  async complete(
    provider: 'garmin' | 'whoop',
    code: string | undefined,
    state: string | undefined,
  ) {
    const parsed = this.verifyState(provider, state);
    const userId = parsed?.userId ?? null;

    if (!code || !parsed) {
      return {
        provider,
        status: 'failed' as const,
        message: 'OAuth callback is missing a valid code or signed state.',
        state: state ?? null,
        userId,
      };
    }

    const secret =
      provider === 'garmin'
        ? this.config.get<string>('GARMIN_CLIENT_SECRET')?.trim()
        : this.config.get<string>('WHOOP_CLIENT_SECRET')?.trim();

    const clientId =
      provider === 'garmin'
        ? this.config.get<string>('GARMIN_CLIENT_ID')?.trim()
        : this.config.get<string>('WHOOP_CLIENT_ID')?.trim();
    const tokenUrl =
      provider === 'garmin'
        ? this.config.get<string>('GARMIN_TOKEN_URL')?.trim()
        : 'https://api.prod.whoop.com/oauth/oauth2/token';

    if (!secret || !clientId || !tokenUrl) {
      if (!this.demoEnabled) {
        return {
          provider,
          status: 'pending_credentials' as const,
          message: 'OAuth token exchange is not configured.',
          state: state ?? null,
          userId,
        };
      }
      return {
        provider,
        status: 'connected_stub' as const,
        message:
          'Demo OAuth connection completed. It is not available outside WEARABLE_DEMO=true.',
        state: state ?? null,
        userId,
        codePresent: true,
        accessToken: `stub_${provider}_${code.slice(0, 8)}`,
        refreshToken: `stub_refresh_${provider}`,
      };
    }

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: secret,
          code,
          grant_type: 'authorization_code',
          redirect_uri:
            provider === 'garmin'
              ? this.config.get<string>('GARMIN_REDIRECT_URI')?.trim() ?? ''
              : this.config.get<string>('WHOOP_REDIRECT_URI')?.trim() ?? '',
        }),
      });
      const token = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        error?: string;
      };
      if (!response.ok || !token.access_token) {
        throw new Error(token.error ?? `token exchange failed (${response.status})`);
      }
      return {
        provider,
        status: 'connected' as const,
        message: 'OAuth token exchange completed.',
        state: state ?? null,
        userId,
        codePresent: true,
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? null,
        needsTokenExchange: false,
      };
    } catch (error) {
      this.logger.warn(`${provider} token exchange failed: ${String(error)}`);
      return {
        provider,
        status: 'failed' as const,
        message: 'OAuth token exchange failed.',
        state: state ?? null,
        userId,
      };
    }
  }

  private get demoEnabled() {
    return this.config.get<string>('WEARABLE_DEMO') === 'true';
  }

  private createState(provider: 'garmin' | 'whoop', userId: string) {
    const payload = Buffer.from(
      JSON.stringify({ provider, userId, ts: Date.now() }),
    ).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  private verifyState(provider: 'garmin' | 'whoop', state?: string) {
    if (!state) return null;
    const [payload, signature] = state.split('.');
    if (!payload || !signature || !this.matchesSignature(payload, signature)) {
      return null;
    }
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
        provider?: string;
        userId?: string;
        ts?: number;
      };
      if (
        parsed.provider !== provider ||
        !parsed.userId ||
        !parsed.ts ||
        Date.now() - parsed.ts > 10 * 60 * 1000
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private sign(payload: string) {
    return createHmac('sha256', this.stateSecret()).update(payload).digest('hex');
  }

  private matchesSignature(payload: string, signature: string) {
    const expected = Buffer.from(this.sign(payload));
    const received = Buffer.from(signature);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  private stateSecret() {
    const secret = this.config.get<string>('WEARABLE_OAUTH_STATE_SECRET')?.trim();
    if (secret) return secret;
    if (this.demoEnabled) return 'local-wearable-demo-state-secret';
    throw new ServiceUnavailableException(
      'WEARABLE_OAUTH_STATE_SECRET is required for wearable OAuth.',
    );
  }
}
