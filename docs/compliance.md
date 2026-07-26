# Compliance & backups

## Data classes

| Class | Examples | Controls |
|---|---|---|
| Identity | email, Firebase UID | Auth guards, role scoping |
| Health | wearables, blood markers, medical flags | ConsentRecord purposes; AuditLog on read/write |
| Sensitive wellness | cycle logs, symptom check-ins, Healthspan snapshots | Explicit opt-in, coach-share consent, export/delete APIs, AuditLog |
| Coaching | notes, programs, chat | Coach–client assignment checks |
| Payments | Razorpay order IDs | Webhook signature verification |

## Consent purposes (enforced in API)

- `wearable_sync`
- `blood_report_analysis`
- `ai_coaching` (when gated)
- `injury_risk_insights` — training-load stress bands (not medical diagnosis)
- `predictive_insights` — short-horizon readiness/fatigue forecasts
- `cricket_analytics` — bowling/session load analytics
- `female_health_tracking` — private cycle and symptom wellness tracking
- `female_health_coach_share` — separately permits a linked coach to view the client’s shared female-health summary
- `healthspan_insights` — rules-based Healthspan wellness estimate

## Sensitive wellness data rights

- `GET /api/consent/sensitive-data/female-health/export` and `GET /api/consent/sensitive-data/healthspan/export` provide the authenticated user’s data export.
- `DELETE /api/consent/sensitive-data/female-health` and `DELETE /api/consent/sensitive-data/healthspan` permanently remove the respective domain data.
- Each export or deletion creates an `AuditLog` record. Female-health coach access requires both an active coach-client assignment and `female_health_coach_share`.

## Encryption

- In transit: TLS on all public endpoints (terminate at load balancer / CDN).
- At rest: managed Postgres encryption + R2 server-side encryption; never commit secrets to git.

## Backups (ops checklist)

1. Enable automated daily Postgres backups + PITR before any real user traffic.
2. Test restore quarterly (document restore time).
3. R2 versioning on for progress photos / blood reports buckets.
4. Retain AuditLog rows ≥ 1 year (product/legal policy).

## AI liability

- Default `AI_REQUIRE_COACH_APPROVAL=true`.
- Clients only see APPROVED insights.
- AuditLog records generation + coach review actions, including `intelligence.run` with feature hashes and key metrics.
- Injury / predictive / cricket copy must never claim diagnosis, selection science, or guaranteed outcomes.
- Cricket analytics for minors: require guardian consent policy before production use as talent screening (product must not market as selection science).
- Female-health and Healthspan content is wellness guidance only. It must not diagnose conditions, predict fertility, or replace professional care. Severe or concerning symptoms display a prompt to seek professional care.

## Phase 7 wellness intelligence

| Signal | Meaning |
|---|---|
| `INJURY_RISK` | ACWR + sleep/HRV modifiers → elevated **training stress** band |
| `READINESS` | Inverse stress heuristic for Recover tab |
| `CRICKET_*` | Bowl spike, match congestion, role gap, under-bowl taper |
| `PredictionSnapshot` | 24h readiness / 72h overreach / 7d fatigue (`modelVersion=rules-v1`) |
| `OutcomeLabel` | Coach/athlete labels for future ML — write path only in v1 |
