import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { ProgressService } from './progress.service';

@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('photos')
  list(@CurrentUser() user: AuthUser) {
    return this.progress.list(user);
  }

  @Post('photos')
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      pose?: string;
      caption?: string;
      weightKg?: number;
      takenAt?: string;
      fileName?: string;
      imageBase64?: string;
      contentType?: string;
    },
  ) {
    return this.progress.create(user, body);
  }

  @Delete('photos/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.progress.remove(user, id);
  }
}
