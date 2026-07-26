# E2E scaffolding

## Flutter (Maestro)

Install [Maestro](https://maestro.mobile.dev/). Flows live under `e2e/maestro/`.

```bash
# Emulator running + API on :3001
maestro test e2e/maestro/smoke.yaml
maestro test e2e/maestro/workout-nutrition-offline.yaml
```

## Coach-web (Playwright)

```bash
cd apps/coach-web
npx playwright install
npx playwright test
```

Tests live under `apps/coach-web/e2e/`.
Set `API_URL` when the API is not at `http://127.0.0.1:3001/api`; the suite
checks the API health contract used by coach workflows as well as the web
login shell.

## Critical paths covered

1. Mobile: welcome → login (dev) → home tabs visible
2. Coach-web: sign in → clients page loads
3. Phase 7: `e2e/maestro/cricket-intelligence.yaml` — cricket log → load UI (optional taps)
4. API unit: `npx jest src/intelligence/rule-packs.spec.ts`
5. Mobile: Train/Fuel logging while offline, then reconnect and verify the
   persisted outbox flushes (`workout-nutrition-offline.yaml`)
6. API: `/api/health` availability (`apps/coach-web/e2e/api-health.spec.ts`)
