import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from './auth.decorators';
import type { AuthUser } from './auth-user';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('session')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  session(@CurrentUser() user: AuthUser) {
    return {
      user,
      message: 'Session established',
    };
  }
}
