import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth-user';

@Injectable()
export class FirebaseBearerStrategy extends PassportStrategy(
  Strategy,
  'firebase-bearer',
) {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(token: string): Promise<AuthUser> {
    if (!token) {
      throw new Error('Missing bearer token');
    }
    return this.authService.validateBearerToken(token);
  }
}
