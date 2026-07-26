# 23PrimeFit Partner API

Partner keys are tenant-scoped and may only read data belonging to the tenant that created them.

## Getting a key

A tenant owner or staff member creates a key with `POST /api/partner/keys`, using the normal bearer token and optional `X-Tenant-Id`. The plaintext key is returned once only. Store it in a secrets manager.

## Authentication

Send the key on every partner request:

```http
X-API-Key: pf_...
```

Every successful key use updates the key's last-use time and creates an `AuditLog` entry (`partner.api_key.used`).

## Read endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/partner/v1/clients` | Active client membership identifiers and join dates |
| GET | `/api/partner/v1/usage` | Tenant usage meter rows |

Responses are intentionally tenant-filtered. Partner endpoints do not expose credentials, health data, or data from other tenants.

## Webhook registry

Use `POST /api/partner/webhooks` with `{ "url": "...", "events": ["client.enrolled"], "secret": "..." }` to register an endpoint. Delivery is a registry scaffold in this phase; no outbound delivery worker is enabled yet.
