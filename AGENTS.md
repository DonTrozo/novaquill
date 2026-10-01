# AGENTS.md

## Cursor Cloud specific instructions

### Overview

NovaQuill is a PDF document signing SaaS built with Next.js 15 (App Router, Turbopack), React 19, Prisma 6, and PostgreSQL 16. See `SETUP.md` for full setup steps and `package.json` for available scripts.

### Services

| Service | How to start | Notes |
|---------|-------------|-------|
| PostgreSQL 16 | `docker compose -f docker-compose.dev.yml up -d` | Required. Must be running before the app starts. |
| Next.js dev server | `npm run dev` | Runs on port 3000 with Turbopack. |

Redis, S3, PayFast, and OAuth providers are optional — the app gracefully degrades without them.

### Environment

- `.env.local` must exist in the project root with at least `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and `STORAGE_ENCRYPTION_KEY`. See `SETUP.md` section 2 for the template.
- Prisma CLI commands (`prisma db push`, `prisma generate`) require `DATABASE_URL` to be exported as a shell env var or loaded via dotenv. Next.js loads `.env.local` automatically but Prisma CLI does not — pass it inline: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/novaquill?schema=public" npx prisma db push`.

### Starting Docker in Cloud Agent VMs

Docker is installed but the daemon must be started manually:

```
sudo dockerd &>/tmp/dockerd.log &
sleep 3
sudo chmod 666 /var/run/docker.sock
```

Then start PostgreSQL: `docker compose -f docker-compose.dev.yml up -d`

After PostgreSQL is healthy, push the schema: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/novaquill?schema=public" npx prisma db push`

### Quality checks

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`

### Key caveats

- The `postinstall` script runs `prisma generate` automatically on `npm install`. If Prisma schema changes, run `npm install` again or `npx prisma generate` manually.
- Signed documents are stored locally under `storage/` when S3 is not configured. This directory is gitignored.
- The sign flow is entirely client-side (pdf-lib in browser); the server only stores the final signed PDF via `POST /api/documents/create`.
