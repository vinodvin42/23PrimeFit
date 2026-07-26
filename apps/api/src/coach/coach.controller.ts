import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import {
  CoachService,
  type MealPlanInput,
  type ProgramInput,
  type RecipeInput,
} from './coach.service';

@ApiTags('coach')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('coach')
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  @Get('clients')
  clients(@CurrentUser() user: AuthUser) {
    return this.coach.listClients(user);
  }

  @Get('catalog')
  catalog() {
    return this.coach.catalog();
  }

  @Get('clients/:clientId')
  overview(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.coach.clientOverview(user, clientId);
  }

  @Patch('clients/:clientId/notes')
  notes(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Body() body: { notes: string },
  ) {
    return this.coach.updateNotes(user, clientId, body.notes ?? '');
  }

  @Post('clients/:clientId/assign-workout/:slug')
  assignWorkout(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Param('slug') slug: string,
  ) {
    return this.coach.assignWorkout(user, clientId, slug);
  }

  @Post('clients/:clientId/assign-meal-plan/:slug')
  assignMeal(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Param('slug') slug: string,
  ) {
    return this.coach.assignMealPlan(user, clientId, slug);
  }

  @Get('cms/catalog')
  cmsCatalog(@CurrentUser() user: AuthUser) {
    return this.coach.cmsCatalog(user);
  }

  @Get('cms/assets')
  cmsAssets(@CurrentUser() user: AuthUser, @Query('q') query?: string) {
    return this.coach.cmsAssets(user, query);
  }

  @Get('cms/programs/:id')
  cmsProgram(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.coach.cmsProgram(user, id);
  }

  @Get('cms/meal-plans/:id')
  cmsMealPlan(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.coach.cmsMealPlan(user, id);
  }

  @Get('cms/clients/:clientId/nutrition-targets')
  clientNutritionTargets(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
  ) {
    return this.coach.clientNutritionTargets(user, clientId);
  }

  @Post('cms/media')
  uploadCmsMedia(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      fileName: string;
      mimeType: string;
      dataBase64: string;
      kind: 'image' | 'video';
    },
  ) {
    return this.coach.uploadCmsMedia(user, body);
  }

  @Post('cms/recipes')
  createRecipe(@CurrentUser() user: AuthUser, @Body() body: RecipeInput) {
    return this.coach.createRecipe(user, body);
  }

  @Post('cms/programs')
  createProgram(@CurrentUser() user: AuthUser, @Body() body: ProgramInput) {
    return this.coach.createProgram(user, body);
  }

  @Patch('cms/programs/:id')
  updateProgram(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ProgramInput,
  ) {
    return this.coach.updateProgram(user, id, body);
  }

  @Delete('cms/programs/:id')
  archiveProgram(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.coach.archiveProgram(user, id);
  }

  @Post('cms/meal-plans')
  createMealPlan(@CurrentUser() user: AuthUser, @Body() body: MealPlanInput) {
    return this.coach.createMealPlan(user, body);
  }

  @Patch('cms/meal-plans/:id')
  updateMealPlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: MealPlanInput,
  ) {
    return this.coach.updateMealPlan(user, id, body);
  }

  @Delete('cms/meal-plans/:id')
  archiveMealPlan(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.coach.archiveMealPlan(user, id);
  }
}
