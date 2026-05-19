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

Anaxi is a single Next.js 14 app with a PostgreSQL 16 database (via Docker Compose). No other infrastructure (Redis, queues, etc.) is required for local dev. Production may use S3 for import file storage and Postgres-backed rate limiting (built in).

### Starting the dev environment

1. Start Postgres: `sudo dockerd &>/tmp/dockerd.log &` then `sudo docker compose up -d`
2. Export the DB URL: `export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/anaxi'`
3. Apply schema: `npx prisma migrate deploy`
4. Seed data: `npx prisma db seed` and optionally `npm run seed:demo` for a full demo dataset
5. Dev server: `npm run dev` (port 3000; set `NEXTAUTH_URL` to match)

### UI mutation feedback

- Success: `toast(msg, "success")` from `@/components/toast-provider`, or redirect + flash query param.
- Validation: inline errors on `FormField` / `.field` controls.
- Submit: disable primary buttons while pending (`useFormStatus` or local state).

See `components/ui/README.md` for list/header reference patterns (`/my-actions`).

### Key commands

| Task | Command |
|------|---------|
| Lint | `npm run lint` |
| Test | `npm test` (vitest) |
| E2E | `npm run test:e2e` (after `npm run seed:demo`) |
| Build | `npm run build` |
| Dev server | `npm run dev` |

### Gotchas

- Run `npm run build` before release; it validates types, lint, and static generation (including `/login` with Suspense).
- **Base seed admin** is `admin@demo-school.local` (tenant `tenant_demo`). **Demo Academy** uses `admin@demo.school` — no email collision when both seeds run.
- **Docker in Cloud VMs** requires `fuse-overlayfs` storage driver and `iptables-legacy`. These are already configured when the environment is set up.
- The `.env` file is created from `.env.example` — defaults work for local dev without any changes needed (except `NEXTAUTH_SECRET` should be set to any non-empty string).
- **CI** runs on push/PR via `.github/workflows/ci.yml` (Postgres service, unit tests, build, Playwright smoke + auth E2E with demo seed).
- **Cron endpoints** (header `x-cron-secret`): `import-pending-count`, `leave-pending-reminders`, `cleanup-shadow-super-admins`, `import-storage-cleanup`, `compute-student-flags`, `process-pending-imports`
- **Health check**: `GET /api/health` (no auth)
- **Production storage**: set `IMPORT_STORAGE_BACKEND=s3` and `IMPORT_S3_BUCKET` for multi-instance deploys

## Imported Claude Cowork project instructions

Anaxi is an institutional intelligence platform for schools.
