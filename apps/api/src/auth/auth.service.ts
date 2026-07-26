import {
  Injectable,
  UnauthorizedException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { AuthUser } from './auth-user';
import { CoachAssignmentService } from '../coach/coach-assignment.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private firebaseReady = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly coachAssignment: CoachAssignmentService,
  ) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const creds = this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    if (projectId && creds) {
      try {
        if (!getApps().length) {
          initializeApp({
            credential: applicationDefault(),
            projectId,
          });
        }
        this.firebaseReady = true;
        this.logger.log('Firebase Admin initialized');
      } catch (err) {
        this.logger.warn(`Firebase Admin init failed: ${String(err)}`);
      }
    } else {
      this.logger.warn(
        'Firebase not configured — use AUTH_DEV_MODE=true with Bearer dev:<uid>',
      );
    }
  }

  async validateBearerToken(token: string): Promise<AuthUser> {
    const devMode = this.config.get<string>('AUTH_DEV_MODE') === 'true';

    if (devMode && token.startsWith('dev:')) {
      return this.upsertFromClaims({
        uid: token.slice(4) || 'dev-user',
        email: `${(token.slice(4) || 'dev-user').replace(/[^a-zA-Z0-9_-]/g, '_')}@dev.local`,
        name: 'Dev User',
        roleHint: token.includes('coach') ? Role.COACH : Role.CLIENT,
      });
    }

    if (!this.firebaseReady) {
      throw new UnauthorizedException(
        'Firebase Auth is not configured. Enable AUTH_DEV_MODE for local development.',
      );
    }

    try {
      const decoded = await getAuth().verifyIdToken(token);
      return this.upsertFromClaims({
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async upsertFromClaims(claims: {
    uid: string;
    email?: string;
    name?: string;
    roleHint?: Role;
  }): Promise<AuthUser> {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: claims.uid },
      include: { profile: true },
    });

    if (existing) {
      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          email: claims.email ?? existing.email,
          displayName: existing.displayName ?? claims.name,
        },
        include: { profile: true },
      });
      if (user.role === Role.CLIENT) {
        await this.coachAssignment.ensureClientHasCoach(user.id);
      }
      return user;
    }

    const created = await this.prisma.user.create({
      data: {
        firebaseUid: claims.uid,
        email: claims.email,
        displayName: claims.name,
        role: claims.roleHint ?? Role.CLIENT,
        profile: { create: {} },
      },
      include: { profile: true },
    });
    if (created.role === Role.CLIENT) {
      await this.coachAssignment.ensureClientHasCoach(created.id);
    }
    return created;
  }
}
