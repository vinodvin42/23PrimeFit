# 23PrimeFit

Health & Performance ecosystem — Flutter (iOS/Android), NestJS API, Next.js coach dashboard.

Phases **1–6** are implemented. Progress photos + local/R2-ready media storage are also live.

## Monorepo

```
apps/mobile      Flutter client
apps/api         NestJS + Prisma API
apps/coach-web   Next.js coach dashboard
docs/            Architecture + data sources
docker-compose.yml  Postgres + Redis
```

## Prerequisites

- Node.js 20+
- Flutter 3.24+ (`flutter` on PATH)
- Docker Desktop (Postgres)

## Quick start

```bash
# 1. Database (Postgres on host port 5433 + Redis)
docker compose up -d

# 2. API
cd apps/api
cp .env.example .env   # already seeded for local docker
npm install
npx prisma migrate deploy
npm run db:seed
npm run start:dev

# 3. Coach web
cd ../coach-web
cp .env.example .env.local
npm install
npm run dev

# 4. Mobile
cd ../mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3001/api --dart-define=AUTH_DEV_MODE=true
```

Android emulator: use `http://10.0.2.2:3001/api` as `API_BASE_URL`.

### Dev auth

With `AUTH_DEV_MODE=true`, any Bearer token `dev:<uid>` creates/upserts a user. The Flutter and coach-web UIs do this automatically from email.

Swagger: http://localhost:3001/api/docs

## Data sources

See [docs/data-sources.md](docs/data-sources.md). Exercise library is seeded from **free-exercise-db** (873 movements + GitHub-hosted images). Media files land in `apps/api/uploads` by default (`STORAGE_DRIVER=local`).

```bash
cd apps/api && npm run db:seed
```

## Phase roadmap

1. Auth / profile / dashboard
2. Workouts + exercise library + progress photos
3. Nutrition & recipes (Open Food Facts + meal plans)
4. Wearables (normalized snapshots + demo sync)
5. Coach chat / consult / payments (Stream/Agora/Razorpay stubs)
6. AI coach / blood reports / biological age
7. ~~Progress media~~ ← done (local storage; wire Cloudflare R2 credentials when ready)

## Phase roadmap (status)

Phases 1–6 feature surface is live in the monorepo. Follow-ups from `next-plan.md`:

- [x] ConsentRecord + AuditLog schema + `/api/consent`
- [x] `packages/ui-tokens` shared brand tokens
- [ ] Crash reporting (Sentry/Crashlytics)
- [ ] Analytics funnel events
- [ ] CI workflows for mobile/api/coach-web
- [ ] Offline Drift queue
- [ ] Human-in-the-loop AI approval

## Still stubs / later

- Real Firebase Auth (disable `AUTH_DEV_MODE`)
- Cloudflare R2 credentials on `STORAGE_DRIVER=r2`
- Native HealthKit / Health Connect plugins
- Live Stream / Agora / Razorpay SDK keys
- Optional `OPENAI_API_KEY` for LLM insights
- Enable Windows Developer Mode if Flutter plugin symlinks fail on Chrome

