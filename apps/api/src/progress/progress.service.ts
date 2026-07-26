import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { AuthUser } from '../auth/auth-user';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  list(user: AuthUser) {
    return this.prisma.progressPhoto.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: 'desc' },
    });
  }

  async create(
    user: AuthUser,
    body: {
      pose?: string;
      caption?: string;
      weightKg?: number;
      takenAt?: string;
      fileName?: string;
      /** Optional base64 (raw or data-url). If omitted, a branded SVG placeholder is stored. */
      imageBase64?: string;
      contentType?: string;
    },
  ) {
    const pose = (body.pose ?? 'front').toLowerCase();
    const takenAt = body.takenAt ? new Date(body.takenAt) : new Date();
    const label = takenAt.toISOString().slice(0, 10);

    let buffer: Buffer;
    let contentType = body.contentType ?? 'image/svg+xml';
    let fileName = body.fileName ?? `${pose}-${label}.svg`;

    if (body.imageBase64) {
      const raw = body.imageBase64.includes(',')
        ? body.imageBase64.split(',')[1]!
        : body.imageBase64;
      buffer = Buffer.from(raw, 'base64');
      if (!body.contentType) {
        contentType = body.imageBase64.startsWith('data:image/png')
          ? 'image/png'
          : body.imageBase64.startsWith('data:image/jpeg')
            ? 'image/jpeg'
            : 'application/octet-stream';
      }
      if (!body.fileName) {
        const ext =
          contentType === 'image/png'
            ? 'png'
            : contentType === 'image/jpeg'
              ? 'jpg'
              : 'bin';
        fileName = `${pose}-${label}.${ext}`;
      }
    } else {
      buffer = this.storage.placeholderSvg({
        pose,
        label,
        weightKg: body.weightKg,
      });
      contentType = 'image/svg+xml';
      fileName = `${pose}-${label}.svg`;
    }

    const stored = await this.storage.putObject({
      folder: 'progress',
      fileName,
      body: buffer,
      contentType,
    });

    return this.prisma.progressPhoto.create({
      data: {
        userId: user.id,
        pose,
        caption: body.caption,
        weightKg: body.weightKg,
        storageKey: stored.storageKey,
        fileUrl: stored.fileUrl,
        contentType: stored.contentType,
        takenAt,
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    const photo = await this.prisma.progressPhoto.findUnique({ where: { id } });
    if (!photo) throw new NotFoundException('Photo not found');
    if (photo.userId !== user.id) throw new ForbiddenException();
    await this.storage.deleteObject(photo.storageKey);
    await this.prisma.progressPhoto.delete({ where: { id } });
    return { ok: true };
  }

  async latestForUser(userId: string) {
    return this.prisma.progressPhoto.findFirst({
      where: { userId },
      orderBy: { takenAt: 'desc' },
    });
  }

  async countForUser(userId: string) {
    return this.prisma.progressPhoto.count({ where: { userId } });
  }
}
