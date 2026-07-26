# 23PrimeFit Data Sources

Copied and normalized from *23PrimeFit – App Data Source Flow*.

## Feature → source

| Feature | Data source | Example providers | Phase |
|---------|-------------|-------------------|-------|
| Exercise videos | Commercial license | Gym Visual, Exercise.com, Physitrack, MoveKit | 2 |
| Exercise images | Commercial license | Gym Visual, MoveKit | 2 |
| Food database | API | Nutritionix, FatSecret, USDA, **Open Food Facts (Phase 3 live)** | 3 |
| Recipes | API / seed | Spoonacular, Edamam, **seeded recipes (Phase 3 live)** | 3 |
| Barcode scanner | API | **Open Food Facts (Phase 3 live)**, Nutritionix | 3 |
| Meal plans | 23PrimeFit | **Seeded coach meal plans (Phase 3 live)** | 3 |
| Sleep | Wearable API | Apple Health, WHOOP, Garmin, Oura — **Phase 4 sync live (demo adapters)** | 4 |
| Stress | Wearable API | Garmin, WHOOP, Fitbit, Oura — **normalized in RecoverySnapshot** | 4 |
| Steps | Wearable API | Apple Health, Google Health Connect — **Phase 4 sync** | 4 |
| Heart rate / HRV / VO₂ / SpO₂ / Load | Wearable API | Apple Health, Garmin, WHOOP, Oura — **Phase 4 fields** | 4 |
| Blood reports | User upload | PDF, JPG, PNG — **Phase 6 analysis live (demo markers)** | 6 |
| AI coach | LLM + KB | OpenAI + rules engine — **Phase 6 insights + bio age** | 6 |
| Progress photos | User upload | Camera / Gallery — **local disk + R2-ready adapter live** | 2 |
| Cricket analytics | 23PrimeFit | Player journal + bowling load + RulePack — **Phase 7 live** | 7 |
| Injury risk | Rules (ACWR) | Wellness stress band — **Phase 7 live (not diagnosis)** | 7 |
| Predictive insights | Rules | 24h/72h/7d PredictionSnapshot — **Phase 7 live (`rules-v1`)** | 7 |
| Chat | SDK | Stream, Sendbird, Twilio — **Phase 5 chat stub live** | 5 |
| Video consultation | SDK | Agora, Zoom — **Phase 5 demo meeting URLs** | 5 |
| Payments | Gateway | Razorpay, Stripe — **Phase 5 Razorpay demo** | 5 |
| Object storage | CDN / bucket | Cloudflare R2 / S3 — **local `uploads/` MVP (`STORAGE_DRIVER`)** | 2 |

## MVP provider defaults (implementation)

- Nutrition: **Nutritionix** + Open Food Facts (barcode)
- Recipes: **Spoonacular**
- Wearables first: **HealthKit** + **Health Connect**
- Chat: **Stream**
- Video: **Agora**
- Payments: **Razorpay**

All external vendors should sit behind adapter interfaces so providers can be swapped without rewriting Flutter screens.
