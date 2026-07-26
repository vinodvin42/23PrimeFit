import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile, unlink, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StoredObject = {
  storageKey: string;
  fileUrl: string;
  contentType: string;
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private root = '';
  private publicBase = '';
  private driver: 'local' | 'r2' = 'local';
  private s3: S3Client | null = null;
  private bucket = '';
  private strict = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.driver =
      (this.config.get<string>('STORAGE_DRIVER') ?? 'local').toLowerCase() ===
      'r2'
        ? 'r2'
        : 'local';
    this.root =
      this.config.get<string>('STORAGE_LOCAL_ROOT') ??
      join(process.cwd(), 'uploads');
    this.publicBase =
      this.config.get<string>('STORAGE_PUBLIC_BASE_URL') ??
      `http://127.0.0.1:${this.config.get('PORT') ?? 3001}/api/media`;
    this.strict =
      this.config.get<string>('STORAGE_STRICT') === 'true' ||
      this.config.get<string>('NODE_ENV') === 'production';

    if (this.driver === 'local') {
      const environment = (
        this.config.get<string>('NODE_ENV') ?? 'development'
      ).toLowerCase();
      const localAllowed =
        environment === 'development' ||
        environment === 'test' ||
        this.config.get<string>('STORAGE_ALLOW_LOCAL') === 'true';
      if (!localAllowed) {
        throw new ServiceUnavailableException(
          'Local storage is disabled outside development/test. Configure STORAGE_DRIVER=r2 or explicitly set STORAGE_ALLOW_LOCAL=true.',
        );
      }
      await mkdir(this.root, { recursive: true });
      this.logger.log(`Local storage ready at ${this.root}`);
      return;
    }

    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim();
    const accessKey = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secret = this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim();
    this.bucket = this.config.get<string>('R2_BUCKET')?.trim() ?? '';
    const r2Public =
      this.config.get<string>('R2_PUBLIC_BASE_URL')?.trim() || this.publicBase;

    if (!accountId || !accessKey || !secret || !this.bucket) {
      if (this.strict) {
        throw new ServiceUnavailableException(
          'STORAGE_DRIVER=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET',
        );
      }
      this.logger.warn(
        'STORAGE_DRIVER=r2 missing credentials — falling back to local (set STORAGE_STRICT=true to fail)',
      );
      this.driver = 'local';
      await mkdir(this.root, { recursive: true });
      return;
    }

    this.publicBase = r2Public.replace(/\/$/, '');
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secret,
      },
    });
    this.logger.log(`R2 storage ready bucket=${this.bucket}`);
  }

  private keyFor(folder: string, fileName: string) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const hash = createHash('sha1')
      .update(randomUUID())
      .digest('hex')
      .slice(0, 8);
    return `${folder}/${hash}-${safeName}`;
  }

  async putObject(input: {
    folder: string;
    fileName: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    const storageKey = this.keyFor(input.folder, input.fileName);

    if (this.driver === 'r2' && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
      return {
        storageKey,
        fileUrl: `${this.publicBase}/${storageKey}`,
        contentType: input.contentType,
      };
    }

    const abs = join(this.root, storageKey);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, input.body);
    return {
      storageKey,
      fileUrl: `${this.publicBase}/${storageKey}`,
      contentType: input.contentType,
    };
  }

  async getSignedGetUrl(storageKey: string, expiresIn = 3600): Promise<string> {
    if (this.driver === 'r2' && this.s3) {
      return getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
        { expiresIn },
      );
    }
    return `${this.publicBase}/${storageKey}`;
  }

  async getObject(storageKey: string): Promise<{
    body: Buffer;
    contentType: string;
  } | null> {
    if (this.driver === 'r2' && this.s3) {
      try {
        const res = await this.s3.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
        );
        const bytes = await res.Body?.transformToByteArray();
        if (!bytes) return null;
        return {
          body: Buffer.from(bytes),
          contentType: res.ContentType ?? this.guessType(storageKey),
        };
      } catch {
        return null;
      }
    }

    try {
      const body = await readFile(join(this.root, storageKey));
      return { body, contentType: this.guessType(storageKey) };
    } catch {
      return null;
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    if (this.driver === 'r2' && this.s3) {
      try {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
        );
      } catch {
        // ignore
      }
      return;
    }
    try {
      await unlink(join(this.root, storageKey));
    } catch {
      // ignore missing file
    }
  }

  private guessType(storageKey: string) {
    if (storageKey.endsWith('.svg')) return 'image/svg+xml';
    if (storageKey.endsWith('.png')) return 'image/png';
    if (storageKey.endsWith('.jpg') || storageKey.endsWith('.jpeg'))
      return 'image/jpeg';
    return 'application/octet-stream';
  }

  placeholderSvg(opts: {
    pose: string;
    label: string;
    weightKg?: number | null;
  }): Buffer {
    const weight =
      opts.weightKg != null ? `${opts.weightKg.toFixed(1)} kg` : '—';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1B3A2F"/>
      <stop offset="100%" stop-color="#2F5D4A"/>
    </linearGradient>
  </defs>
  <rect width="480" height="640" fill="url(#g)"/>
  <rect x="48" y="64" width="384" height="512" rx="24" fill="#0F241C" opacity="0.35"/>
  <text x="240" y="280" text-anchor="middle" fill="#C8F560" font-family="Arial,sans-serif" font-size="42" font-weight="700">${opts.pose.toUpperCase()}</text>
  <text x="240" y="340" text-anchor="middle" fill="#E8EFE9" font-family="Arial,sans-serif" font-size="22">${opts.label}</text>
  <text x="240" y="390" text-anchor="middle" fill="#A8B5AC" font-family="Arial,sans-serif" font-size="18">${weight}</text>
</svg>`;
    return Buffer.from(svg, 'utf8');
  }
}
