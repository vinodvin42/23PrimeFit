import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Wearable aggregator decision: Terra | Vital | Spike (or native-only).
 * Locked default: Terra when TERRA_API_KEY set; otherwise native HealthKit/HC first.
 */
@Injectable()
export class WearableAggregatorAdapter {
  private readonly logger = new Logger(WearableAggregatorAdapter.name);

  constructor(private readonly config: ConfigService) {}

  get provider(): 'terra' | 'vital' | 'spike' | 'native' {
    const forced = this.config
      .get<string>('WEARABLE_AGGREGATOR')
      ?.trim()
      .toLowerCase();
    if (forced === 'terra' || forced === 'vital' || forced === 'spike') {
      return forced;
    }
    if (this.config.get<string>('TERRA_API_KEY')?.trim()) return 'terra';
    if (this.config.get<string>('VITAL_API_KEY')?.trim()) return 'vital';
    if (this.config.get<string>('SPIKE_APPLICATION_ID')?.trim()) return 'spike';
    return 'native';
  }

  get enabled() {
    return this.provider !== 'native';
  }

  status() {
    const decision = this.provider;
    this.logger.log(`Wearable aggregator mode: ${decision}`);
    return {
      provider: decision,
      enabled: this.enabled,
      garminWhoopViaAggregator: this.enabled,
      note:
        decision === 'native'
          ? 'Using HealthKit/Health Connect first. Set WEARABLE_AGGREGATOR=terra|vital|spike + vendor keys before deep Garmin/WHOOP.'
          : `${decision} selected — wire webhook receivers for Garmin/WHOOP through this aggregator.`,
    };
  }
}
