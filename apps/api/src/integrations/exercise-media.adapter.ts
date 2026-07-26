import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Licensed exercise media adapter (Gym Visual / MoveKit).
 * Until a license is active, falls back to free-exercise-db GitHub stills.
 */
@Injectable()
export class ExerciseMediaAdapter {
  private readonly logger = new Logger(ExerciseMediaAdapter.name);

  constructor(private readonly config: ConfigService) {}

  get provider() {
    return (
      this.config.get<string>('EXERCISE_MEDIA_PROVIDER')?.trim() ||
      'free_exercise_db'
    );
  }

  get licensed() {
    return Boolean(
      this.config.get<string>('EXERCISE_MEDIA_CDN_BASE')?.trim() &&
      this.provider !== 'free_exercise_db',
    );
  }

  resolveImageUrls(exerciseId: string, filenames: string[]): string[] {
    const cdn = this.config.get<string>('EXERCISE_MEDIA_CDN_BASE')?.trim();
    if (this.licensed && cdn) {
      return filenames.map(
        (f) => `${cdn.replace(/\/$/, '')}/${exerciseId}/${f}`,
      );
    }
    // Default: yuhonas free-exercise-db raw GitHub
    const base =
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
    return filenames.map((f) => `${base}/${exerciseId}/${f}`);
  }

  /** Optional video URLs when CDN hosts mp4/webm under videos/ */
  resolveVideoUrls(
    exerciseId: string,
    filenames: string[] = ['demo.mp4'],
  ): string[] {
    const cdn = this.config.get<string>('EXERCISE_MEDIA_CDN_BASE')?.trim();
    if (!this.licensed || !cdn) return [];
    return filenames.map(
      (f) => `${cdn.replace(/\/$/, '')}/${exerciseId}/videos/${f}`,
    );
  }

  enrichExercise(exercise: {
    id: string;
    slug?: string;
    imagesJson?: string | null;
    videoUrl?: string | null;
  }) {
    let filenames: string[] = [];
    try {
      const parsed: unknown = JSON.parse(exercise.imagesJson || '[]');
      if (Array.isArray(parsed)) filenames = parsed.map(String);
    } catch {
      filenames = [];
    }
    const images = this.resolveImageUrls(
      exercise.slug || exercise.id,
      filenames.length ? filenames : ['0.jpg'],
    );
    const videos = exercise.videoUrl
      ? [exercise.videoUrl]
      : this.resolveVideoUrls(exercise.slug || exercise.id);
    return { images, videos, media: this.status() };
  }

  status() {
    return {
      provider: this.provider,
      licensed: this.licensed,
      note: this.licensed
        ? 'Serving licensed CDN assets'
        : 'Using free-exercise-db stills — set EXERCISE_MEDIA_PROVIDER + EXERCISE_MEDIA_CDN_BASE for Gym Visual/MoveKit',
    };
  }
}
