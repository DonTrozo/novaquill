# NovaQuill

NovaQuill is a minimalist PDF signing app: sign in, upload a PDF, create or reuse a signature, place it on the document, and download a flattened signed PDF.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- NextAuth
- Prisma + PostgreSQL
- pdf-lib for PDF finalisation
- pdfjs-dist for browser PDF preview
- Cloudinary raw storage for encrypted signed documents
- Redis-backed rate limiting when `REDIS_URL` is configured
- PayFast for Pro subscriptions

## Core routes

- `/` — landing page with signed-in PDF upload entry
- `/upload` — authenticated upload flow that opens the editor immediately after PDF selection
- `/sign` — authenticated document editor using the in-memory upload context
- `/dashboard` — authenticated signing workspace, saved signatures, recent documents, usage, export/delete controls
- `/pricing` — Free/Pro Monthly/Pro Annual plans and PayFast checkout entry
- `/login` and `/register` — account access

## Local setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000`.

## Required environment variables

See `.env.example` for the complete list.

Minimum local development variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `STORAGE_ENCRYPTION_KEY`

Generate `STORAGE_ENCRYPTION_KEY` with:

```bash
openssl rand -base64 32
```

## Google OAuth redirect URI mismatch

If Google sign-in fails with `redirect_uri_mismatch`, confirm the production OAuth client has these authorised redirect URIs:

```text
https://www.novaquill.co.za/api/auth/callback/google
https://novaquill.co.za/api/auth/callback/google
```

Set the deployed production environment to:

```env
NEXTAUTH_URL=https://www.novaquill.co.za
```

The redirect URI must match exactly, including protocol, domain, path, and `www`. Keep both `www` and non-`www` callback URLs authorised if users can reach either domain.

## Document storage

Signed PDFs are encrypted with AES-256-GCM before storage.

In production, Cloudinary must be configured:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

When Cloudinary is not configured outside production, the app falls back to local encrypted storage under `storage/documents`. Do not rely on local filesystem storage on Vercel or other serverless platforms.

## PDF worker

`pdfjs-dist` expects the worker file at:

```text
public/pdf.worker.min.mjs
```

If PDF preview fails in development or deployment, confirm that this file exists and matches the installed `pdfjs-dist` version.

## Auth

Auth options are defined once in `src/lib/auth.ts` and reused by the NextAuth route at `src/app/api/auth/[...nextauth]/route.ts`.

Supported providers:

- Credentials
- Google, when configured
- Apple, when configured

## Subscriptions and usage

- Free accounts: 3 signed documents per month.
- Pro Monthly accounts: unlimited signing with monthly billing.
- Pro Annual accounts: unlimited signing with discounted annual billing.
- Uploading and signing require sign-in so credits, saved documents, and account usage can be tracked.

## Production notes

- Configure Redis with `REDIS_URL`; in-memory rate limiting is not reliable across serverless instances.
- Configure Cloudinary; local storage is not production-safe on Vercel.
- Keep compliance wording conservative: NovaQuill creates simple electronic signatures by flattening a signature image into a PDF. Advanced or qualified signatures require a certified trust service provider.

## Useful commands

```bash
npm run lint
npm run typecheck
npm run build
```
