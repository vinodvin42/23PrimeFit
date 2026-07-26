import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiAdapter {
  private readonly logger = new Logger(OpenAiAdapter.name);
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (key) {
      this.client = new OpenAI({ apiKey: key });
      this.logger.log('OpenAI adapter ready');
    } else {
      this.logger.warn('OPENAI_API_KEY missing — using rules engine only');
    }
  }

  get enabled() {
    return this.client != null;
  }

  async enrichInsight(title: string, body: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content:
              'You are a fitness coach assistant. Rewrite the insight briefly, keep medical caution, no diagnosis.',
          },
          { role: 'user', content: `${title}\n\n${body}` },
        ],
      });
      return res.choices[0]?.message?.content?.trim() || null;
    } catch (err) {
      this.logger.warn(`OpenAI enrich failed: ${String(err)}`);
      return null;
    }
  }

  /** Vision OCR for blood report images (base64). Returns extracted text. */
  async extractBloodText(imageBase64: string, mimeType = 'image/jpeg') {
    if (!this.client) return null;
    try {
      const res = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content:
              'Extract lab marker names and numeric values from this blood report image. Reply as plain text lines like "LDL 118". No diagnosis.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      });
      return res.choices[0]?.message?.content?.trim() || null;
    } catch (err) {
      this.logger.warn(`OpenAI vision OCR failed: ${String(err)}`);
      return null;
    }
  }
}
