import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { WorkoutsService } from './workouts.service';

@ApiTags('workouts')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller()
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Get('exercises')
  listExercises(
    @Query('q') q?: string,
    @Query('muscle') muscle?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.workouts.listExercises({
      q,
      muscle,
      category,
      limit: limit ? Number(limit) : 40,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get('exercises/:id')
  async getExercise(@Param('id') id: string) {
    const ex = await this.workouts.getExercise(id);
    if (!ex) throw new NotFoundException('Exercise not found');
    return ex;
  }

  @Get('workouts/programs')
  programs() {
    return this.workouts.listPrograms();
  }

  @Get('workouts/programs/:slug')
  async program(@Param('slug') slug: string) {
    const p = await this.workouts.getProgram(slug);
    if (!p) throw new NotFoundException('Program not found');
    return p;
  }

  @Get('workouts/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.workouts.myWorkouts(user);
  }

  @Get('workouts/sessions/:id')
  async session(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.workouts.getSession(user, id);
    if (!s) throw new NotFoundException('Session not found');
    return s;
  }

  @Post('workouts/sessions/:id/start')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workouts.startSession(user, id);
  }

  @Post('workouts/sessions/:id/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { perceivedEffort?: number; notes?: string },
  ) {
    return this.workouts.completeSession(user, id, body);
  }

  @Post('workouts/assign/:slug')
  assign(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.workouts.assignProgram(user, slug);
  }
}
