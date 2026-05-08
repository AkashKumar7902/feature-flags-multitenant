# Byepo Multi-Tenant Feature Flag Management System

A production-style implementation of the assignment using **Express**, **PostgreSQL**, and **three separate Next.js applications**.

## Live demo

| Surface | URL |
|---|---|
| Super Admin | https://feature-flags-super-admin.vercel.app |
| Organization Admin | https://feature-flags-admin-tau.vercel.app |
| End User | https://feature-flags-user.vercel.app |
| API (Render) | https://feature-flags-api-1h32.onrender.com/health |
| API docs (Swagger UI) | https://feature-flags-api-1h32.onrender.com/docs |

Demo credentials are in the [Demo credentials](#demo-credentials) section. The Render free tier sleeps after 15 min of idle traffic, so the first request after a quiet period takes ~30 seconds to cold-start; a GitHub Actions keepalive pings the API every 10 minutes to minimise this.

The system supports:

- Super Admin login with static environment-based credentials.
- Organization creation and organization listing.
- Organization-specific admin invite codes.
- Organization Admin signup/login.
- Tenant-scoped feature flag create/update/delete.
- End User signup/login.
- End User feature evaluation by feature key.
- Optional public feature checker for quick demos.
- Persistent storage for organizations, users, roles, feature flags, refresh sessions, and audit logs.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| API | Express 5 + TypeScript | Explicit routing/middleware, simple assignment fit, strong control over auth and tenancy. |
| Database | PostgreSQL 16 | Relational integrity, composite uniqueness, transactional writes, durable tenant data. |
| ORM/Migrations | Prisma | Strong schema, generated client, migration history, safer development loop. |
| Frontend | Three Next.js App Router apps | Separate surfaces for Super Admin, Admin, and User while sharing the same API. |
| Auth | Custom password + token auth | No Auth0/Firebase/Cognito/NextAuth. Passwords use Argon2id; tokens are signed by the API. |
| Validation | Zod shared contract package | Same request rules can be used across backend and future clients. |
| Security defaults | Helmet, CORS allow-list, rate limits, httpOnly cookies | Reasonable baseline without pretending this is fully production-hardened. |

## Repository layout

```text
.
├── apps
│   ├── api              # Express API, Prisma schema, migrations, seed, tests
│   ├── super-admin      # Next.js app on port 3000
│   ├── admin            # Next.js app on port 3001
│   └── user             # Next.js app on port 3002
├── packages
│   └── contracts        # Shared Zod schemas and DTO types
├── docker-compose.yml   # Local PostgreSQL
├── pnpm-workspace.yaml
└── turbo.json
```

## Prerequisites

- Node.js 22+
- Docker Desktop or Docker Engine
- pnpm 9+

Install pnpm if it is not already available:

```bash
npm install -g pnpm@9
```

## Local setup

From the project root:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/super-admin/.env.example apps/super-admin/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp apps/user/.env.example apps/user/.env.local

pnpm install
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open the apps:

| App | URL |
|---|---|
| Super Admin | http://localhost:3000 |
| Organization Admin | http://localhost:3001 |
| End User | http://localhost:3002 |
| API Health | http://localhost:4000/health |

## Demo credentials

The seed creates Acme and Beta demo tenants. Super Admin credentials come from `apps/api/.env`.

```text
Super Admin
email:    super@byepo.local
password: SuperAdmin#2026

Organization Admin
email:    admin@acme.test
password: AcmeAdmin#123
org:      acme-health

End User
email:    user@acme.test
password: AcmeUser#123
org:      acme-health

Seeded admin invite codes
acme-health: acme-admin-invite-2026
beta-retail: beta-admin-invite-2026
```

Seeded flags:

```text
acme-health / smart_dashboard = enabled
acme-health / billing_v2      = disabled
beta-retail / smart_dashboard = disabled
```

## Core flows

### 1. Super Admin creates an organization

1. Open http://localhost:3000.
2. Login with Super Admin credentials.
3. Create an organization.
4. Copy the admin invite code shown after creation.

The invite code is stored only as a SHA-256 hash in PostgreSQL and is shown as plaintext only when generated or rotated.

### 2. Organization Admin signs up and manages flags

1. Open http://localhost:3001/signup.
2. Enter the organization slug and admin invite code.
3. Create, update, and delete feature flags.

Admin API calls do not accept an organization id from the browser. The API reads the tenant from the signed access token.

### 3. End User checks a feature

1. Open http://localhost:3002.
2. Login or sign up with an organization slug.
3. Submit a feature key such as `smart_dashboard`.
4. The API responds whether the feature is enabled for that user’s organization.

A public demo checker also exists at http://localhost:3002/public-check for quick manual testing.

## Important scripts

```bash
pnpm dev               # run API and all three Next apps via Turbo
pnpm dev:api           # API only
pnpm dev:super-admin   # Super Admin app only
pnpm dev:admin         # Admin app only
pnpm dev:user          # User app only
pnpm db:up             # start PostgreSQL container
pnpm db:migrate        # run Prisma dev migration
pnpm db:deploy         # deploy migrations without creating a new one
pnpm db:seed           # seed demo tenants/users/flags
pnpm typecheck         # TypeScript checks
pnpm build             # production build
pnpm test              # API e2e test suite
```

## API summary

Live interactive docs (Swagger UI): https://feature-flags-api-1h32.onrender.com/docs
Raw OpenAPI spec: https://feature-flags-api-1h32.onrender.com/openapi.json

```text
GET  /health
GET  /docs                  (Swagger UI)
GET  /openapi.json

POST /v1/auth/super-admin/login
POST /v1/auth/org-admin/signup
POST /v1/auth/org-admin/login
POST /v1/auth/end-user/signup
POST /v1/auth/end-user/login
POST /v1/auth/refresh
POST /v1/auth/logout
GET  /v1/auth/me

GET  /v1/super-admin/organizations
POST /v1/super-admin/organizations
GET  /v1/super-admin/organizations/:id
POST /v1/super-admin/organizations/:id/rotate-admin-invite

GET    /v1/admin/feature-flags
POST   /v1/admin/feature-flags
PATCH  /v1/admin/feature-flags/:id
DELETE /v1/admin/feature-flags/:id

POST /v1/user/feature-evaluations
POST /v1/public/feature-evaluations
```

## Data model highlights

- `organizations.slug` is globally unique.
- `roles` is a persisted table, not just a TypeScript enum.
- `users.email` is unique and stored as PostgreSQL `CITEXT` for case-insensitive uniqueness.
- `feature_flags` has a composite unique key on `(organization_id, key)` so two tenants can use the same feature key independently.
- `refresh_sessions` stores HMAC-hashed refresh tokens and supports token rotation.
- `audit_logs` records sensitive tenant actions.

