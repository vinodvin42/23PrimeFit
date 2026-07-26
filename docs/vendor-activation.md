# Wave B — vendor activation checklist

Use this when flipping demo → production. Adapters are already env-gated.

## 1. Firebase + FCM

1. Replace `apps/mobile/android/app/google-services.json` (placeholder) and add iOS `GoogleService-Info.plist`.
2. API: `AUTH_DEV_MODE=false`, `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`.
3. Flutter: `--dart-define=AUTH_DEV_MODE=false --dart-define=FIREBASE_ENABLED=true --dart-define=ANALYTICS_ENABLED=true`.
4. Confirm `POST /notifications/device` stores `Profile.fcmToken` (apply `prisma/fcm_token.sql`).
5. Send a test notification via Firebase console or `NotificationsService.pushToUser`.

## 2. Sentry

1. Set `SENTRY_DSN` on API (and Flutter `--dart-define=SENTRY_DSN=…`).
2. Trigger a test exception; confirm event in Sentry project.
3. API init: `apps/api/src/observability/sentry.ts`.

## 3. Cloudflare R2

1. Create bucket + API token.
2. Set `STORAGE_DRIVER=r2`, `R2_*`, optionally `STORAGE_STRICT=true`.
3. Upload a progress photo; URL should use `R2_PUBLIC_BASE_URL`.

## 4. Wearables (device)

1. Physical Android/iOS device (not emulator for Health Connect reliability).
2. `--dart-define=WEARABLE_DEMO=false`.
3. Grant health permissions; Recover → Sync should hit `/recovery/sync` with native payload.

## 5. Stream / Agora / Razorpay

1. Set API keys (`STREAM_*`, `AGORA_*`, `RAZORPAY_*`).
2. Flutter: `--dart-define=STREAM_CLIENT_ENABLED=true` (etc.) after adding native SDKs:
   - `stream_chat_flutter`
   - `agora_rtc_engine`
   - `razorpay_flutter`
3. Pay a consult → Razorpay Checkout (or demo auto-PAID) → optional `POST /consultations/:id/confirm-payment` for live keys → webhook `POST /api/webhooks/razorpay`.
4. Join via `GET /consultations/:id/meeting` (Agora token when keyed; demo URL otherwise).
5. Chat dual-writes to Stream when `STREAM_API_KEY` + secret are set; Postgres remains source of truth.

## 6. OpenAI / Spoonacular / Exercise media

1. `OPENAI_API_KEY` + keep `AI_REQUIRE_COACH_APPROVAL=true`.
2. Blood upload with `imageBase64` uses vision OCR when keyed.
3. `SPOONACULAR_API_KEY` for live remote recipes; without it Fuel uses seeded fallback + import.
4. `EXERCISE_MEDIA_PROVIDER` + `EXERCISE_MEDIA_CDN_BASE` for Gym Visual / MoveKit video URLs.

## 7. Garmin / WHOOP OAuth

1. Set `GARMIN_CLIENT_ID` / `WHOOP_CLIENT_ID` (+ secrets + redirect URIs).
2. Mobile Recover starts OAuth; stub deep-link `primefit://wearables/connect` when unset.
3. `POST /recovery/oauth/:provider/complete` persists connection + opaque `metaJson` tokens.
