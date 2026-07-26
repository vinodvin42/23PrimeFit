# Production integrations

## Feature flags / env gates

| Concern | Without keys | With keys |
|---|---|---|
| Auth | `AUTH_DEV_MODE=true` + `Bearer dev:<uid>` | Firebase Admin + Flutter/web Firebase Auth |
| Media | `STORAGE_DRIVER=local` | `STORAGE_DRIVER=r2` + R2_* |
| Crash reporting | no-op | `SENTRY_DSN` |
| Wearables | `WEARABLE_DEMO=true` / Sync demo | HealthKit + Health Connect native payloads |
| Chat | Postgres threads | `STREAM_API_KEY` + secret (dual-write on send) |
| Video | demo meet URL + `/consultations/:id/meeting` | `AGORA_APP_ID` + certificate |
| Payments | demo capture | `RAZORPAY_*` + confirm-payment + webhooks |
| AI | rules engine | `OPENAI_API_KEY`; coach approval when `AI_REQUIRE_COACH_APPROVAL=true` |
| Recipes | seeded + Fuel remote fallback | `SPOONACULAR_API_KEY` |
| Exercise media | free-exercise-db stills | `EXERCISE_MEDIA_CDN_BASE` + provider |

Never commit real secrets. Copy `apps/api/.env.example` → `.env` and `apps/coach-web/.env.example` → `.env.local`.

## Flutter dart-defines

```
--dart-define=API_BASE_URL=http://10.0.2.2:3001/api
--dart-define=AUTH_DEV_MODE=true
--dart-define=FIREBASE_ENABLED=false
--dart-define=SENTRY_DSN=
--dart-define=ANALYTICS_ENABLED=false
--dart-define=WEARABLE_DEMO=true
--dart-define=STREAM_CLIENT_ENABLED=false
--dart-define=AGORA_CLIENT_ENABLED=false
--dart-define=RAZORPAY_CLIENT_ENABLED=false
```

## Client adapters (env-gated)

| Adapter | Dart define | Behavior without SDK |
|---|---|---|
| Stream | `STREAM_CLIENT_ENABLED` | Fetches `/chat/stream-token`; Postgres chat UI continues |
| Agora | `AGORA_CLIENT_ENABLED` | Logs meeting payload from pay/book |
| Razorpay | `RAZORPAY_CLIENT_ENABLED` | Demo capture when API returns `mode=demo` |
| Health | `WEARABLE_DEMO=false` | Reads Health Connect / HealthKit; else demo sync |
| Garmin/WHOOP | API `GARMIN_*` / `WHOOP_*` | OAuth start/complete stubs + callback route |

## Offline

Drift SQLite outbox at `primefit_outbox.sqlite` (migrates legacy SharedPreferences queue once). Flush runs at app launch and whenever connectivity returns.

## Windows Developer Mode (required for Flutter plugins)

Native plugins (`firebase_*`, `health`, `mobile_scanner`, `sentry_flutter`, etc.) need symlink support on Windows:

1. Run `start ms-settings:developers`
2. Enable **Developer Mode**
3. Re-run `flutter pub get` then `flutter run` on the Android emulator

Without this, `flutter pub add` may still update `pubspec.yaml` but builds fail with “Building with plugins requires symlink support.”

## Wave B / C activation

- [vendor-activation.md](./vendor-activation.md) — Firebase, Sentry, R2, Stream/Agora/Razorpay, OpenAI
- [wearable-aggregator.md](./wearable-aggregator.md) — Terra/Vital/Spike decision
- [compliance.md](./compliance.md) — consent, encryption, backups
- [e2e.md](./e2e.md) — Maestro + Playwright scaffolds

## CD

See [cd-codemagic.md](./cd-codemagic.md) and root `codemagic.yaml`.

## Firebase platform files

Place real `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) under `apps/mobile` after creating a Firebase project. A placeholder Android file exists for Gradle; replace it before enabling Firebase. Keep `FIREBASE_ENABLED=false` until those files are real.
