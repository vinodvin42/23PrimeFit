import { Injectable, Logger } from '@nestjs/common';
import { OpenAiAdapter } from './openai.adapter';

/**
 * Blood report OCR — OpenAI vision when keyed, else heuristic/defaults.
 */
@Injectable()
export class BloodOcrAdapter {
  private readonly logger = new Logger(BloodOcrAdapter.name);

  constructor(private readonly openai: OpenAiAdapter) {}

  extractMarkers(input: {
    fileName: string;
    ocrText?: string;
    markers?: Record<string, number>;
  }): {
    markers: Record<string, number>;
    summary: string;
    mode: 'provided' | 'ocr_stub' | 'vision' | 'defaults';
  } {
    if (input.markers && Object.keys(input.markers).length > 0) {
      return {
        markers: input.markers,
        summary: 'Markers provided by client; OCR skipped.',
        mode: 'provided',
      };
    }

    const fromText = this.parseText(input.ocrText ?? '');
    if (Object.keys(fromText).length > 0) {
      return {
        markers: fromText,
        summary: 'Markers extracted from OCR/vision text.',
        mode: input.ocrText?.includes('vision') ? 'vision' : 'ocr_stub',
      };
    }

    return {
      markers: {
        ldl: 118,
        hdl: 52,
        hba1c: 5.4,
        fastingGlucose: 92,
      },
      summary: `Parsed with demo marker defaults pending OCR pipeline (${input.fileName}).`,
      mode: 'defaults',
    };
  }

  async extractFromImage(input: {
    fileName: string;
    imageBase64?: string;
    mimeType?: string;
    markers?: Record<string, number>;
    ocrText?: string;
  }) {
    let ocrText = input.ocrText;
    let modeHint = 'ocr_stub';
    if (!ocrText && input.imageBase64 && this.openai.enabled) {
      const vision = await this.openai.extractBloodText(
        input.imageBase64,
        input.mimeType ?? 'image/jpeg',
      );
      if (vision) {
        ocrText = vision;
        modeHint = 'vision';
        this.logger.log('Vision OCR text acquired');
      }
    }
    const result = this.extractMarkers({
      fileName: input.fileName,
      ocrText,
      markers: input.markers,
    });
    if (modeHint === 'vision' && result.mode === 'ocr_stub') {
      return { ...result, mode: 'vision' as const, summary: 'Markers extracted via OpenAI vision OCR.' };
    }
    return result;
  }

  private parseText(text: string): Record<string, number> {
    const lower = text.toLowerCase();
    if (!lower.trim()) return {};
    const markers: Record<string, number> = {};
    const patterns: Array<[string, RegExp]> = [
      ['ldl', /ldl[^0-9]{0,12}(\d{2,3}(?:\.\d+)?)/i],
      ['hdl', /hdl[^0-9]{0,12}(\d{2,3}(?:\.\d+)?)/i],
      ['hba1c', /hba1c[^0-9]{0,12}(\d(?:\.\d+)?)/i],
      ['fastingGlucose', /(?:fasting\s*)?glucose[^0-9]{0,12}(\d{2,3}(?:\.\d+)?)/i],
      ['triglycerides', /triglyc[^0-9]{0,12}(\d{2,3}(?:\.\d+)?)/i],
    ];
    for (const [key, re] of patterns) {
      const m = lower.match(re);
      if (m?.[1]) markers[key] = Number(m[1]);
    }
    return markers;
  }
}
