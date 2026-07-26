# Continuous delivery (Codemagic / stores)

## Codemagic (Flutter)

1. Connect the GitHub repo in [Codemagic](https://codemagic.io).
2. Use workflow file `codemagic.yaml` at the repo root (scaffold below).
3. Add encrypted env groups:
   - `API_BASE_URL`, `SENTRY_DSN`
   - `FIREBASE_ENABLED=true` only after real `google-services.json` / `GoogleService-Info.plist` are in the build
   - Store signing: Android keystore + Apple certs / App Store Connect API key
4. Publishing:
   - Android → Google Play internal track
   - iOS → TestFlight

## Scaffold `codemagic.yaml` (copy to repo root when ready)

```yaml
workflows:
  mobile-android:
    name: Mobile Android
    instance_type: mac_mini_m2
    max_build_duration: 60
    environment:
      flutter: stable
      groups:
        - mobile_secrets
    scripts:
      - name: Get packages
        script: |
          cd apps/mobile
          flutter pub get
      - name: Build APK
        script: |
          cd apps/mobile
          flutter build apk --release \
            --dart-define=API_BASE_URL=$API_BASE_URL \
            --dart-define=AUTH_DEV_MODE=false \
            --dart-define=FIREBASE_ENABLED=true \
            --dart-define=SENTRY_DSN=$SENTRY_DSN
    artifacts:
      - apps/mobile/build/app/outputs/**/*.apk

  mobile-ios:
    name: Mobile iOS
    instance_type: mac_mini_m2
    max_build_duration: 90
    environment:
      flutter: stable
      xcode: latest
      groups:
        - mobile_secrets
    scripts:
      - name: Get packages
        script: |
          cd apps/mobile
          flutter pub get
      - name: Build IPA
        script: |
          cd apps/mobile
          flutter build ipa --release \
            --dart-define=API_BASE_URL=$API_BASE_URL \
            --dart-define=AUTH_DEV_MODE=false \
            --dart-define=FIREBASE_ENABLED=true \
            --dart-define=SENTRY_DSN=$SENTRY_DSN
    artifacts:
      - apps/mobile/build/ios/ipa/*.ipa
```

## API / coach-web

- API: deploy Nest build (`npm run build` in `apps/api`) to your host; set secrets from `.env.example`.
- Coach web: `apps/coach-web` → Vercel/Netlify with `NEXT_PUBLIC_*` vars.

Keep `AUTH_DEV_MODE=true` and `FIREBASE_ENABLED=false` for local emulator builds until Firebase files are real.
