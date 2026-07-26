import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RtcTokenBuilder, RtcRole } = require('agora-access-token') as {
  RtcTokenBuilder: {
    buildTokenWithUid: (
      appId: string,
      appCertificate: string,
      channelName: string,
      uid: number,
      role: number,
      privilegeExpiredTs: number,
    ) => string;
  };
  RtcRole: { PUBLISHER: number };
};

@Injectable()
export class AgoraAdapter {
  private readonly logger = new Logger(AgoraAdapter.name);
  private readonly appId: string;
  private readonly certificate: string;

  constructor(private readonly config: ConfigService) {
    this.appId = this.config.get<string>('AGORA_APP_ID')?.trim() ?? '';
    this.certificate =
      this.config.get<string>('AGORA_APP_CERTIFICATE')?.trim() ?? '';
    if (this.enabled) {
      this.logger.log('Agora adapter ready');
    } else {
      this.logger.warn('Agora not configured — using demo meeting URLs');
    }
  }

  get enabled() {
    return Boolean(this.appId && this.certificate);
  }

  get demoEnabled() {
    return this.config.get<string>('AGORA_DEMO') === 'true';
  }

  meetingFor(consultationId: string, uid = 0) {
    const channel = `pf_${consultationId.slice(0, 12)}`;
    if (!this.enabled) {
      if (!this.demoEnabled) {
        throw new ServiceUnavailableException(
          'Video consultations are unavailable. Configure Agora credentials or set AGORA_DEMO=true for local demos.',
        );
      }
      return {
        mode: 'demo' as const,
        channel,
        meetingUrl: `https://meet.23primefit.local/agora/${channel}`,
        token: `agora_demo_token_${consultationId.slice(0, 6)}`,
        appId: null as string | null,
      };
    }

    const expire = Math.floor(Date.now() / 1000) + 60 * 60 * 2;
    const token = RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.certificate,
      channel,
      uid,
      RtcRole.PUBLISHER,
      expire,
    );
    return {
      mode: 'agora' as const,
      channel,
      meetingUrl: `agora://${channel}`,
      token,
      appId: this.appId,
    };
  }
}
