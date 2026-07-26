import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, FirebaseAuthGuard } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { NutritionService } from './nutrition.service';

@ApiTags('nutrition')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutrition: NutritionService) {}

  @Get('foods')
  foods(@Query('q') q?: string) {
    return this.nutrition.listLocalFoods(q);
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.nutrition.searchFoods(q);
  }

  @Get('barcode/:code')
  barcode(@Param('code') code: string) {
    return this.nutrition.lookupBarcode(code);
  }

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.nutrition.today(user);
  }

  @Post('logs')
  add(
    @CurrentUser() user: AuthUser,
    @Body() body: { foodItemId: string; mealType: string; servings?: number },
  ) {
    return this.nutrition.addLog(user, body);
  }

  @Delete('logs/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.nutrition.deleteLog(user, id);
  }

  @Get('recipes')
  recipes(@Query('q') q?: string) {
    return this.nutrition.listRecipes(q);
  }

  @Get('recipes-remote')
  recipesRemote(@Query('q') q = '') {
    return this.nutrition.searchRemoteRecipes(q);
  }

  @Post('recipes-remote/import')
  importRemote(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      externalId: string;
      title: string;
      imageUrl?: string;
      readyInMinutes?: number;
      servings?: number;
      calories?: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      localSlug?: string;
    },
  ) {
    return this.nutrition.importRemoteRecipe(user, body);
  }

  @Get('recipes/:slug')
  recipe(@Param('slug') slug: string) {
    return this.nutrition.getRecipe(slug);
  }

  @Get('meal-plans')
  mealPlans() {
    return this.nutrition.listMealPlans();
  }

  @Get('meal-plans/:slug')
  mealPlan(@Param('slug') slug: string) {
    return this.nutrition.getMealPlan(slug);
  }

  @Post('meal-plans/:slug/assign')
  assign(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.nutrition.assignMealPlan(user, slug);
  }

  @Get('clients/:clientId/summary')
  clientSummary(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
  ) {
    return this.nutrition.clientNutritionSummary(user, clientId);
  }
}
