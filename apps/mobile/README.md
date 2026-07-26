# 23PrimeFit Mobile

Flutter client for iOS and Android (Phase 1: auth, profile, dashboard).

## Run

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001/api --dart-define=AUTH_DEV_MODE=true
```

On iOS simulator use `http://127.0.0.1:3001/api`. Dev auth uses email/password locally without Firebase when `AUTH_DEV_MODE=true`.
