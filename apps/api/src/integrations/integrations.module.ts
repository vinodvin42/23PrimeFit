import { Module } from '@nestjs/common';
import { StreamAdapter } from './stream.adapter';
import { AgoraAdapter } from './agora.adapter';
import { RazorpayAdapter } from './razorpay.adapter';
import { OpenAiAdapter } from './openai.adapter';
import { WearableOauthAdapter } from './wearable-oauth.adapter';
import { BloodOcrAdapter } from './blood-ocr.adapter';
import { FcmAdapter } from './fcm.adapter';
import { NutritionixAdapter } from './nutritionix.adapter';
import { FatSecretAdapter } from './fatsecret.adapter';
import { SpoonacularAdapter } from './spoonacular.adapter';
import { ExerciseMediaAdapter } from './exercise-media.adapter';
import { WearableAggregatorAdapter } from './wearable-aggregator.adapter';

@Module({
  providers: [
    StreamAdapter,
    AgoraAdapter,
    RazorpayAdapter,
    OpenAiAdapter,
    WearableOauthAdapter,
    BloodOcrAdapter,
    FcmAdapter,
    NutritionixAdapter,
    FatSecretAdapter,
    SpoonacularAdapter,
    ExerciseMediaAdapter,
    WearableAggregatorAdapter,
  ],
  exports: [
    StreamAdapter,
    AgoraAdapter,
    RazorpayAdapter,
    OpenAiAdapter,
    WearableOauthAdapter,
    BloodOcrAdapter,
    FcmAdapter,
    NutritionixAdapter,
    FatSecretAdapter,
    SpoonacularAdapter,
    ExerciseMediaAdapter,
    WearableAggregatorAdapter,
  ],
})
export class IntegrationsModule {}
