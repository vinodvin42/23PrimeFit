---
name: 23PrimeFit Flutter Apps
overview: Multi-tenant SaaS plan for 23PrimeFit as a Flutter iOS/Android client, NestJS backend, and Next.js coach web, serving subscribed independent coach businesses alongside 23PrimeFit's own coaches and clients.
todos: []
isProject: false
---

# 23PrimeFit iOS & Android App Plan

## Context
Product goal: one multi-tenant Health & Performance ecosystem (workouts, nutrition, wearables, coaching) for general fitness, weight loss, athletes, cricket, lifestyle disorders, and coaches.

**Commercial model:** independent coaches and coaching companies self-register, create an isolated workspace, and purchase a 23PrimeFit service plan to manage their clients. 23PrimeFit also operates its own first-party tenant for company coaches and direct clients.

**Locked decisions**
- Mobile: Flutter (single codebase, iOS + Android)
- Scope: full architecture (Phases 1-6); first build = Phase 1
- Backend: NestJS + PostgreSQL + Prisma + Redis
- Coach dashboard: Next.js (web; Phase 5 UI, scaffolded early)
- Auth: Firebase Auth (email/OTP + social); API verifies Firebase JWT
- Media: Cloudflare R2 / S3 (progress photos, blood reports, exercise assets)
- Chat / video / payments (Phase 5+): Stream, Agora, Razorpay (+ Stripe later)
- Tenancy: every coaching business is an isolated `Tenant`; the tenant owns its subscription, team memberships, clients, content, usage, and operational data
- First-party operations: 23PrimeFit's own coaches and clients live in a dedicated internal tenant, not in unscoped global tables

---

## Target architecture

```
          Tenant clients and coach businesses
      Flutter (iOS/Android)   Next.js Coach Dashboard
                 |                      |
                 v                      v
          Tenant Context + RBAC + Entitlements
                 23PrimeFit Backend (NestJS API)
                 |         |         |
                 v         v         v
             AI Engine  Redis Jobs  Postgres / R2
                 |
                 v
         Licensed APIs: Nutritionix/OFF, Exercise Adapter,
         HealthKit/Health Connect/Garmin/WHOOP, Stream, Agora, Razorpay
```

**Design principle (from PDF):** buy licensed data/APIs; build unique value (coaching programs, metabolic health, Female Health, Healthspan, cricket later, AI guidance, unified UX). Competitive apps (WHOOP, Garmin Connect, Health Connect, MyFitnessPal, Workout for Women, Cal AI) are benchmarks — not a mandate to rebuild each product in isolation.

---

## Monorepo layout (to create)

```
23PrimeFit/
  apps/
    mobile/          # Flutter client
    coach-web/       # Next.js coach dashboard
    api/             # NestJS backend
  packages/
    shared-types/    # OpenAPI-generated or shared DTOs
    ui-tokens/        # NEW: shared design tokens (colors, spacing, type scale) consumed by mobile + coach-web
  infra/               # NEW: IaC (Terraform or Pulumi), per-env config
    envs/
      dev/
      staging/
      prod/
  docs/
    architecture.md
    data-sources.md
    api-contracts.md     # NEW
    runbook.md            # NEW: on-call / operational notes
  .github/
    workflows/            # NEW: CI pipelines per app
```

**Why the additions:** `ui-tokens` prevents the Flutter app and Next.js dashboard drifting into two different visual languages; `infra/` and `.github/workflows` get environment parity and CI in place before Phase 2, when the team starts growing and manual deploys become a bottleneck.

---

## Domain model (core entities)

- **User / Profile** -- global identity and personal profile; authorization does not come from a single global role
- **Tenant** -- isolated coaching workspace (`EXTERNAL_COACH_BUSINESS` or `PRIMEFIT_INTERNAL`)
- **TenantMembership** -- user-to-tenant role (`OWNER`, `ADMIN`, `COACH`, `NUTRITIONIST`, `STAFF`, `ANALYST`)
- **ClientMembership / Coach-Client** -- client enrollment and coach assignment inside one tenant
- **Plan / Subscription / Entitlement / UsageMeter** -- tenant purchase, limits, feature access, trial/grace/read-only states
- **Invoice / PaymentAttempt / SubscriptionEvent** -- billing between a coach business and 23PrimeFit; separate from payments a coach collects from clients
- WorkoutProgram / WorkoutSession / Exercise -- library + assigned plans
- NutritionLog / FoodItem / Recipe / MealPlan
- WearableSnapshot -- sleep, stress, steps, HR, HRV, VO2, SpO2, calories, training load
- ProgressPhoto / HealthReport -- uploads + metadata
- MessageThread / Consultation / Notification / Payment
- **FemaleHealthProfile / CycleLog / SymptomCheckIn (NEW)** -- opt-in menstrual/female-health tracking; phase estimates; tenant-scoped; coach share only with granular consent
- **HealthspanSnapshot (NEW)** -- versioned Healthspan score, estimated Biological Age, pace/trend, pillar explainJson, data-coverage confidence, modelVersion
- **AuditLog (NEW)** -- every read/write touching medical history, health reports, wearable data, cycle data, or Healthspan, with actor + timestamp. Needed for Phase 6+ compliance and for debugging AI recommendation disputes later.
- **ConsentRecord (NEW)** -- tracks what the user has agreed to share (wearable sync, blood report analysis, AI coaching, `female_health_tracking`, `female_health_coach_share`, `healthspan_insights`), required before Phase 4/6/Female Health/Healthspan ship. Cheaper to model the table now than retrofit later.

Every tenant-owned model carries `tenantId`. API authorization requires tenant membership plus role permission. Database constraints, object-storage keys, cache keys, queues, search indexes, analytics, exports, AI knowledge, and audit logs are tenant-scoped. Global 23PrimeFit catalog content is read-only until copied or assigned into a tenant.

All commercial providers behind adapters so Nutritionix <-> FatSecret or Gym Visual <-> MoveKit can swap without rewriting app screens.

## Coach SaaS onboarding and lifecycle

1. Coach registers and verifies identity.
2. Coach creates a business workspace, slug, timezone, currency, and branding.
3. Coach selects a trial or paid 23PrimeFit service plan and completes checkout.
4. Subscription activation creates entitlements for client count, team seats, storage, AI, integrations, reporting, and branding.
5. Tenant owner invites staff and imports or invites clients.
6. Users with multiple memberships choose an active workspace; all requests carry that tenant context.
7. Failed or cancelled subscriptions enter a grace period, then become read-only before any archival policy runs.

Platform admins manage tenants, plans, subscriptions, usage, support access, and the 23PrimeFit internal tenant through a separate audited control plane.

---

## Provider choices (MVP defaults)

| Feature | Provider (MVP) | Phase | Fallback / Notes |
|---|---|---|---|
| Exercise media | Licensed DB adapter (schema first; Gym Visual/MoveKit when licensed) | 2 | Keep adapter contract stable regardless of vendor |
| Food DB | Nutritionix | 3 | FatSecret as backup if rate limits/cost bite |
| Barcode | Open Food Facts (+ Nutritionix fallback) | 3 | OFF is free/open, good for MVP cost control |
| Recipes | Spoonacular | 3 | Edamam as backup |
| Wearables | HealthKit + Health Connect first; Garmin/WHOOP OAuth next | 4 | Evaluate Terra/Vital/Spike aggregator before building 4+ native connectors -- could collapse Phase 4 into one integration |
| Chat | Stream | 5 | -- |
| Video consult | Agora | 5 | -- |
| Payments | Razorpay | 5 | Stripe later for non-India expansion |
| AI coach | OpenAI + private knowledge base | 6 | Human-in-the-loop review before recommendations reach clients |

---

## Flutter app structure

`apps/mobile` -- feature-first + clean architecture:

- `lib/core` -- theme, routing (go_router), DI, networking (Dio), secure storage
- `lib/features/auth|profile|dashboard|workouts|nutrition|wearables|coach|progress|ai`
- State: Riverpod
- Local cache: Drift/SQLite for offline workout/nutrition day logs
- Push: Firebase Cloud Messaging
- **Error/crash reporting (NEW): Sentry or Firebase Crashlytics** -- wire in during Phase 1 so Phase 2+ regressions are visible immediately, not discovered via App Store reviews
- **Analytics (NEW): Firebase Analytics or Amplitude** -- instrument key funnel events (signup -> onboarding complete -> first workout logged) from Phase 1 so activation/retention can be measured from day one

**Client app IA (bottom nav after login)**
1. Home (dashboard)
2. Train (workouts)
3. Fuel (nutrition)
4. Recover (wearables/sleep/stress)
5. Coach (messages / booking / content)

**Offline strategy (NEW):** workout logging and nutrition entries must work with no connectivity (gym basements, flights). Writes go to Drift first, a sync queue flushes to the API on reconnect, and conflict resolution is last-write-wins with a server timestamp. This needs to be designed into the data layer in Phase 1/2, not bolted on later.

---

## Phase roadmap

### Phase 1 -- Login, Client Profile, Dashboard (first implementation)
- Firebase Auth (email + Google; phone OTP optional)
- Coach self-registration, tenant creation, active-workspace selection, and invitation acceptance
- 23PrimeFit internal tenant seed for first-party coaches and clients
- Tenant membership RBAC and request-scoped tenant guard
- Plan/subscription/entitlement schema with a demo trial activation path; production checkout can follow
- Onboarding: age, sex, height, weight, goals, lifestyle-disorder tags, activity level
- Profile CRUD via NestJS
- Home dashboard shells: today's summary placeholders (workout, nutrition, recovery cards)
- Coach-web scaffold: login + empty clients list
- CI stubs, env templates, OpenAPI contract for `/auth`, `/users/me`, `/dashboard`
- **NEW:** ConsentRecord + AuditLog tables scaffolded (empty/unused UI, but schema present so Phase 4/6 don't require migrations that touch historical data)
- **NEW:** Crash reporting + analytics wired into Flutter and coach-web shells

### Phase 2 -- Workout Builder + Exercise Library
- Exercise catalog API + media CDN URLs
- Coach assigns programs; client completes sessions (sets/reps/RPE)
- Flutter workout player (video + cues)
- Progress photos upload
- **NEW:** Offline write queue for workout logging (see Offline strategy above)

### Phase 3 -- Nutrition & Recipes
- Food search, barcode scan, meal logging, macros/calories
- Coach nutrition plans; recipe browse
- Daily nutrition card on dashboard
- **NEW:** Provider fallback logic tested (Nutritionix -> FatSecret) so a provider outage doesn't take down logging entirely

### Phase 4 -- Wearables
- iOS HealthKit + Android Health Connect sync (steps, HR, sleep, active energy, VO2 where available)
- Backend normalize -> WearableSnapshot
- Recover tab charts; later Garmin/WHOOP connectors
- **NEW:** Aggregator decision finalized before this phase starts (see Provider choices table) -- do not begin native Garmin/WHOOP/Fitbit/Oura work until this is settled, it's the single biggest scope risk in the roadmap
- **NEW:** ConsentRecord enforced -- wearable sync only starts after explicit user opt-in, logged

### Phase 5 -- Coach Dashboard, Chat, Consultation
- Tenant-aware coach web: workspace/team settings, clients, assign workouts/nutrition, notes
- 23PrimeFit service plan, usage, subscription, invoice, and upgrade screens for tenant owners
- Platform admin tenant and subscription operations
- Stream chat in Flutter + web
- Agora video booking + Razorpay for paid consults
- Notifications (FCM)
- **NEW:** Payment failure/refund handling and webhook reconciliation (Razorpay webhooks -> payment status) -- easy to under-scope, causes support burden if skipped

### Phase 6 -- AI + Health intelligence
- Ingest workouts + nutrition + wearables + uploaded blood reports
- Recommendations, progress reports; cricket analytics as follow-ons
- **NEW:** Human-in-the-loop review step -- coach can approve/edit AI output before client sees it (liability + trust)
- **NEW:** AuditLog captures every AI recommendation generated, its inputs, and any coach edits -- needed if a recommendation is later disputed

### Phase 6.5 -- Female Health (opt-in wellness)
- Opt-in cycle tracking: period history, flow, pain, mood, energy, sleep, symptoms, daily check-ins
- Phase estimates with irregular-cycle support (prioritize symptoms/readiness over calendar)
- Cycle-aware workout, nutrition, and recovery suggestions (wellness only — no diagnosis, fertility prediction, contraception advice, or treatment claims)
- Granular consent: private by default; coach visibility requires `female_health_coach_share`
- Tenant-scoped storage, audit logs, export/delete; concerning-symptom flags recommend professional care without diagnosing
- Later (separately reviewed): contraception profiles, pregnancy/postpartum, perimenopause, menopause

### Phase 6.6 -- Healthspan / Biological Age
- Versioned Healthspan score, estimated Biological Age, pace/trend, pillar drivers, data-coverage confidence
- Long-window inputs: sleep consistency/duration, steps, cardio zones, strength time, VO2 max, RHR, HRV, body composition, mobility; optional labs when consented
- Require sufficient baseline (e.g. multi-week recovery/activity coverage) before showing an estimate; surface `modelVersion` and confidence
- Explainable wellness guidance only — not a validated medical/longevity claim; coach HITL for client-facing insight cards
- Consent `healthspan_insights`; tenant isolation, audit, and usage accounting for every score run

---

## Data flows (from PDF)

- User Input + Wearable APIs + Coach Content --> Backend --> Flutter App + Coach Web + AI Engine --> back to Flutter App
- **Nutrition:** Nutritionix/OFF -> search/scan/recipes -> Nutrition Tracker
- **Exercise:** Licensed DB -> videos/images/muscles/equipment -> Workout Builder -> Client Workout
- **AI:** wearables + history + nutrition + reports + coach content -> recommendations

---

## Non-functional requirements (NEW)

| Concern | Requirement |
|---|---|
| Availability | API target 99.5% uptime post-Phase 5 (paid consults depend on it) |
| Data privacy | Health data (medical history, blood reports, wearable metrics) encrypted at rest and in transit; access scoped by role; ConsentRecord gates any sharing with AI engine |
| Tenant isolation | Every tenant-owned query requires `tenantId`; deny cross-tenant identifiers; tenant scope propagates to storage, jobs, caches, search, analytics, exports, and AI context |
| Billing enforcement | Subscription entitlements are enforced server-side; webhook processing is idempotent; failed payments follow explicit grace and read-only states |
| Performance | Dashboard cold load < 2s on mid-tier Android; wearable sync jobs must not block API request threads (queued via Redis workers) |
| Scalability | NestJS API stateless behind a load balancer from Phase 1, so horizontal scaling is a config change, not a redesign, when Phase 4/5 traffic grows |
| Observability | Structured logging + request tracing from Phase 1 (even minimal) so Phase 4 wearable sync failures are debuggable in production |
| Backups | PostgreSQL automated daily backups + point-in-time recovery before any real user data (Phase 1 launch) |

---

## Testing & CI/CD strategy (NEW)

- **Unit tests**: NestJS services (Jest), Flutter widgets/blocs (flutter_test), Next.js components
- **Integration tests**: API endpoints against a test Postgres instance (Docker Compose in CI), including mandatory tenant A cannot read/update/delete tenant B fixtures
- **E2E**: Critical flows first -- coach signup -> workspace -> trial -> invite client; client invite -> onboarding -> dashboard; workout logging -- using Patrol or Maestro for Flutter and Playwright for coach-web
- **CI**: GitHub Actions per app (`apps/mobile`, `apps/api`, `apps/coach-web`), triggered on PR; lint + unit tests required to merge; E2E runs nightly or pre-release
- **CD**: API auto-deploys to `dev` on merge to main; manual promote to `staging`/`prod`; mobile builds via Fastlane/Codemagic to TestFlight/Play internal track from Phase 1 so stakeholders can see progress on real devices every phase

---

## Phase 1 build slice (concrete deliverables)

1. Initialize monorepo: Flutter app, NestJS API, Next.js coach-web stubs
2. PostgreSQL schema: `users`, `profiles`, `tenants`, `tenant_memberships`, `client_memberships`, `coach_clients`, `plans`, `subscriptions`, `entitlements`, `usage_meters`, `consent_records`, `audit_logs`
3. Seed the `PRIMEFIT_INTERNAL` tenant and migrate all existing unscoped coach/client data into it
4. Auth bridge: Firebase token -> NestJS guard -> user upsert -> active tenant context
5. Coach onboarding: registration, workspace creation, demo trial activation, team/client invitations
6. Flutter screens: splash, login, invitation acceptance, onboarding, profile edit, home dashboard
7. Coach web: workspace selection, subscription state, empty clients list, invite-client path
8. Design system: brand tokens; expressive typography; tokens shared via `packages/ui-tokens`
9. Docs: data sources, tenant-boundary rules, API contracts, env templates, and billing webhook lifecycle
10. CI: lint/unit plus cross-tenant integration tests for all tenant-aware modules
11. Crash reporting and analytics with tenant-safe metadata (never attach health data)

---

## Out of scope for first code pass
Phases 2-6 implementation (planned only). No real Nutritionix/Stream keys until those phases. No AI until Phase 6.

---

## Risks (NEW)

| Risk | Impact | Mitigation |
|---|---|---|
| Wearable API approval delays (Garmin/WHOOP developer review can take weeks) | Blocks Phase 4 start | Apply for API access in Phase 1, not Phase 4 |
| Aggregator-vs-native indecision | Could double Phase 4 scope | Decide before Phase 4 kickoff, not during |
| Health data compliance gaps | Legal/trust risk at launch | ConsentRecord + AuditLog modeled from Phase 1; encryption at rest before any real user data |
| Female Health / Healthspan clinical overclaim | Trust and regulatory risk | Wellness-only copy; no diagnosis/fertility/contraception claims; baseline + confidence gates; coach HITL |
| AI recommendation liability | Support/trust risk in Phase 6 | Human-in-the-loop coach approval before client sees AI output |
| Design drift between Flutter app and Next.js dashboard | Inconsistent brand, slower Phase 5 UI work | Shared `ui-tokens` package from Phase 1 |
| Cross-tenant data leakage | Critical privacy and contractual failure | Mandatory tenant guard, tenant-scoped repositories, database constraints, audit logs, and adversarial integration tests |
| SaaS billing mixed with coach-client commerce | Incorrect accounting and access control | Separate platform subscriptions/invoices from tenant client payments in schema, services, UI, and webhooks |

---

## Success criteria (Phase 1)
- Install Flutter app on iOS Simulator + Android emulator
- Sign up / sign in, complete onboarding, edit profile, see personalized dashboard shell
- Independent coach can register, create a workspace, activate a trial, and invite a client
- 23PrimeFit staff can operate the internal tenant with company-owned coaches and clients
- API persists profile and active tenant; coach web shows only that tenant's clients
- Automated tests prove tenant A cannot access tenant B data
- **NEW:** CI green on all three apps; a crash or key funnel event is visible in Sentry/Analytics dashboard
- **NEW:** ConsentRecord and AuditLog tables exist in schema, even if not yet exercised by UI

---

## Product references (benchmarks, not integrations)

Use WHOOP, Garmin Connect, Google Health / Health Connect, MyFitnessPal, Workout for Women (and cycle-aware peers), and Cal AI as UX/competitive references. Full differentiation table lives in [`review-till-future.md`](review-till-future.md). Prefer HealthKit / Health Connect and licensed nutrition adapters over building native clones of each vendor app.