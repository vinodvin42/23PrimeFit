# 23PrimeFit Architecture

## Stack
- **Mobile:** Flutter (iOS + Android) — `apps/mobile`
- **API:** NestJS + Prisma + PostgreSQL — `apps/api`
- **Coach web:** Next.js — `apps/coach-web`
- **Auth:** Firebase ID tokens in production; `AUTH_DEV_MODE` accepts `Bearer dev:<uid>` locally
- **Media:** Cloudflare R2 in non-local deployments; local disk is restricted to development/test unless `STORAGE_ALLOW_LOCAL=true`
- **Cache/jobs (later):** Redis via `docker-compose.yml`

## Phase coverage

| Phase | Status |
|-------|--------|
| 1 Auth / profile / dashboard | Live |
| 2 Workouts + progress photos | Live |
| 3 Nutrition | Live (OFF + seeded recipes) |
| 4 Wearables | Live (demo sync) |
| 5 Coach / chat / consult / pay | Live (stubs) |
| 6 AI / blood / bio age | Live (rules + optional OpenAI) |
| 7 Cricket / injury / predictive | Live (rules-v1 intelligence engine) |

## Key API groups

| Prefix | Purpose |
|--------|---------|
| `/api/auth`, `/api/users` | Session + profile |
| `/api/dashboard/today` | Home cards |
| `/api/workouts`, `/api/exercises` | Programs + library |
| `/api/nutrition` | Logs, search, recipes |
| `/api/recovery` | Wearable snapshots |
| `/api/intelligence` | HealthSignal + PredictionSnapshot + OutcomeLabel |
| `/api/cricket` | Athlete profile, sessions, load dashboard |
| `/api/female-health` | Consent-gated cycle profile, logs, symptom check-ins, wellness suggestions |
| `/api/healthspan` | Consent-gated baseline, current rules-based wellness estimate, history |
| `/api/consent/sensitive-data/:domain` | Authenticated export and deletion for female health / Healthspan |
| `/api/chat`, `/api/consultations`, `/api/notifications` | Coach hub |
| `/api/ai` | Insights, blood reports, bio age |
| `/api/progress/photos` | Progress check-ins |
| `/api/vision` | Editable rules-based meal recognition and coach-reviewed posture drafts |
| `/api/crm` | Tenant lead pipeline and client package invoices |
| `/api/platform/analytics` | Platform-admin MRR and usage aggregates |
| `/api/knowledge` | Tenant knowledge upload and cited keyword retrieval |
| `/api/marketplace` | Public published listings, tenant publishing, and client enrollment |
| `/api/partner`, `/api/partner/v1` | Tenant API-key administration and partner read endpoints |
| `/api/media/:folder/:file` | Public media bytes |

Swagger UI: `http://localhost:3001/api/docs`

## Data flow

```
User / Wearables / Coach  →  NestJS API  →  PostgreSQL
                                ↓
                          uploads / R2
                                ↓
                     Flutter + Coach Web
```

Commercial adapters remain swappable (see `data-sources.md`). Stream, Agora,
Razorpay, FCM, Garmin/WHOOP OAuth, and R2 activate with their respective
credentials. Demo responses require explicit `*_DEMO=true` flags; production
paths fail closed when required credentials are absent.

## Sensitive wellness boundaries

Female-health and Healthspan records are user-owned, tenant-scoped only when a tenant is associated, and protected by dedicated consent purposes. Coach female-health access is summary-only and requires a separate share consent. Healthspan estimates use `healthspan-rules-v1`, persist coverage confidence and pillars, and enter the existing AI review queue as `healthspan` drafts.
