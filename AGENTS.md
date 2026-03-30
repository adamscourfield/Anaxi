# Agent notes
Follow user-provided instructions.

## Local dev boot sequence for Codex
When a task needs authenticated UI checks (e.g., Playwright screenshots):

```bash
docker compose up -d
export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/anaxi'
npx prisma migrate deploy
npx prisma db seed
npm run dev
# then playwright
```

## Cursor Cloud specific instructions

### Services overview

Anaxi is a single Next.js 14 app with a PostgreSQL 16 database (via Docker Compose). No other infrastructure (Redis, queues, etc.) is required.

### Starting the dev environment

1. Start Postgres: `sudo dockerd &>/tmp/dockerd.log &` then `sudo docker compose up -d`
2. Export the DB URL: `export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/anaxi'`
3. Apply schema: `npx prisma db push` (use `db push` instead of `migrate deploy` — the migration `20260320000000` has a date-ordering bug that causes it to run before the init migration)
4. Seed data: `npx prisma db seed` and optionally `npm run seed:demo` for a full demo dataset
5. Dev server: `npm run dev` (port 5000)

### Key commands

| Task | Command |
|------|---------|
| Lint | `npm run lint` |
| Test | `npm test` (vitest, 285 tests) |
| Build | `npm run build` |
| Dev server | `npm run dev` |

### Gotchas

- **`npm run build` fails** with a slug conflict error. This is a pre-existing issue related to the assessments route structure. The dev server (`npm run dev`) works fine.
- **Login with `admin@demo.school`** will fail if both the base seed and demo seed have been run, because this email exists in two tenants and the auth code rejects ambiguous matches. Either pass `tenantId=demo_academy` in the login form, or use a unique-email user like `sarah.chen@demo.school` / `Password123!`.
- **Docker in Cloud VMs** requires `fuse-overlayfs` storage driver and `iptables-legacy`. These are already configured when the environment is set up.
- The `.env` file is created from `.env.example` — defaults work for local dev without any changes needed (except `NEXTAUTH_SECRET` should be set to any non-empty string).
