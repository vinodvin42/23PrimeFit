# Firebase (Flutter)

1. Create a Firebase project and enable Email/Password (+ Google optional).
2. Add Android/iOS apps; download:
   - `android/app/google-services.json` (replace the placeholder)
   - `ios/Runner/GoogleService-Info.plist`
3. Packages already in `pubspec.yaml`:
   - `firebase_core`, `firebase_auth`, `firebase_messaging`, `firebase_analytics`
4. Run with:
   ```
   --dart-define=AUTH_DEV_MODE=false
   --dart-define=FIREBASE_ENABLED=true
   --dart-define=ANALYTICS_ENABLED=true
   ```
5. API: set `AUTH_DEV_MODE=false`, `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`.

Until those files are real, keep `AUTH_DEV_MODE=true` (default). `AuthRepository.signIn` / `register` use Firebase when enabled and ready; otherwise `dev:` tokens.

**Windows note:** Flutter plugins need Developer Mode (symlink support) enabled for `flutter pub get` native plugins.
