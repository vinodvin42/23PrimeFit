import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamChat } from 'stream-chat';

/** Stream Chat token minting — no-op when STREAM_API_KEY unset. */
@Injectable()
export class StreamAdapter {
  private readonly logger = new Logger(StreamAdapter.name);
  private client: StreamChat | null = null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('STREAM_API_KEY')?.trim();
    const secret = this.config.get<string>('STREAM_API_SECRET')?.trim();
    if (key && secret) {
      this.client = StreamChat.getInstance(key, secret);
      this.logger.log('Stream Chat adapter ready');
    } else {
      this.logger.warn('Stream Chat not configured — using Postgres chat');
    }
  }

  get enabled() {
    return this.client != null;
  }

  async userToken(userId: string, name?: string | null) {
    if (!this.client) {
      return { mode: 'postgres' as const, token: null };
    }
    await this.client.upsertUser({
      id: userId,
      name: name ?? userId,
    });
    return {
      mode: 'stream' as const,
      token: this.client.createToken(userId),
      apiKey: this.config.get<string>('STREAM_API_KEY'),
    };
  }

  /** Ensure a messaging channel exists and optionally post a message. */
  async syncThreadMessage(input: {
    threadId: string;
    coachId: string;
    clientId: string;
    senderId: string;
    text: string;
  }) {
    if (!this.client) return { mode: 'postgres' as const, synced: false };
    const channelId = `pf_${input.threadId.slice(0, 40)}`;
    const channel = this.client.channel('messaging', channelId, {
      members: [input.coachId, input.clientId],
      created_by_id: input.senderId,
    });
    await channel.create();
    await channel.sendMessage({
      text: input.text,
      user_id: input.senderId,
    });
    return { mode: 'stream' as const, synced: true, channelId };
  }
}
