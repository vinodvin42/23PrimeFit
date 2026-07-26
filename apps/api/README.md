# 23PrimeFit API

NestJS + Prisma + PostgreSQL. Phase 1: auth, profile, dashboard.

```bash
cp .env.example .env
npx prisma migrate deploy
npm run start:dev
```

- Health: `GET /api/health`
- Docs: http://localhost:3001/api/docs
- Dev auth: `Authorization: Bearer dev:<uid>` when `AUTH_DEV_MODE=true`
