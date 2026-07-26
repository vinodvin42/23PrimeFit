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

  @Get('hydration/today')
  hydrationToday(@CurrentUser() user: AuthUser) {
    return this.nutrition.hydrationToday(user);
  }

  @Post('hydration')
  logHydration(
    @CurrentUser() user: AuthUser,
    @Body() body: { amountMl: number },
  ) {
    return this.nutrition.logHydration(user, body.amountMl);
  }

  @Get('hydration/history')
  hydrationHistory(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string,
  ) {
    return this.nutrition.hydrationHistory(user, days ? Number(days) : 7);
  }

  @Get('supplements')
  listSupplements(@CurrentUser() user: AuthUser) {
    return this.nutrition.listSupplements(user);
  }

  @Post('supplements')
  createSupplement(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; dosage?: string; schedule?: string },
  ) {
    return this.nutrition.createSupplement(user, body);
  }

  @Patch('supplements/:id/deactivate')
  deactivateSupplement(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.nutrition.deactivateSupplement(user, id);
  }

  @Post('supplements/:id/log')
  logSupplement(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.nutrition.logSupplement(user, id);
  }

  @Delete('supplements/:id/log')
  unlogSupplement(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.nutrition.unlogSupplement(user, id);
  }

  @Get('fasting/current')
  fastingCurrent(@CurrentUser() user: AuthUser) {
    return this.nutrition.fastingCurrent(user);
  }

  @Post('fasting/start')
  startFasting(
    @CurrentUser() user: AuthUser,
    @Body() body: { targetHours?: number },
  ) {
    return this.nutrition.startFasting(user, body?.targetHours);
  }

  @Post('fasting/end')
  endFasting(@CurrentUser() user: AuthUser) {
    return this.nutrition.endFasting(user);
  }

  @Get('fasting/history')
  fastingHistory(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.nutrition.fastingHistory(user, days ? Number(days) : 14);
  }

  @Get('shopping-list')
  listShoppingList(@CurrentUser() user: AuthUser) {
    return this.nutrition.listShoppingList(user);
  }

  @Post('shopping-list')
  addShoppingListItem(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; quantity?: string },
  ) {
    return this.nutrition.addShoppingListItem(user, body);
  }

  @Post('shopping-list/from-recipe/:slug')
  addShoppingListItemsFromRecipe(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
  ) {
    return this.nutrition.addShoppingListItemsFromRecipe(user, slug);
  }

  @Patch('shopping-list/:id')
  updateShoppingListItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { checked?: boolean; name?: string; quantity?: string },
  ) {
    return this.nutrition.updateShoppingListItem(user, id, body);
  }

  @Delete('shopping-list/checked')
  clearCheckedShoppingListItems(@CurrentUser() user: AuthUser) {
    return this.nutrition.clearCheckedShoppingListItems(user);
  }

  @Delete('shopping-list/:id')
  removeShoppingListItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.nutrition.removeShoppingListItem(user, id);
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
