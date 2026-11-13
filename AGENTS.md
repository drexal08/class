# LMS Core — coding agent context

LMS Core is a Next.js 16 App Router app (React 19, Prisma 7 + PostgreSQL,
Firebase Auth/Admin, Pusher). This file is the shared memory for coding agents
working on the repository; deeper product notes live in `README.md`,
`SETUP.md` and `docs/`.

## Commands

```bash
npm run dev          # local development
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run build        # prisma generate && next build
npm run db:generate  # regenerate the Prisma client after schema changes
npm run db:migrate   # create/apply a dev migration
npm run db:deploy    # apply committed migrations in production
npm run db:seed      # demo data
```

Run typecheck, lint and build before handing work back. A clean tree means all
three pass.

## Architecture rules

- `src/lib/data/*` is server-only reads. `src/lib/actions/*` is `"use server"`
  mutations. Never import either from a client component.
- Authorization lives in `src/lib/auth/guards.ts` (`requireUser`,
  `requireCourseAccess`, `requireCourseTeacher`, …). Resolve a resource *inside*
  the scoped query (`where: { id, courseId }`) rather than checking after a
  lookup.
- The Prisma client is generated to `src/generated/prisma`. Schema changes need
  `npm run db:generate`; committed migrations live in `prisma/migrations`.
- UI uses the slate shadcn tokens (`bg-card`, `text-muted-foreground`,
  `border-border`, `text-danger`, `text-warning`). Do not introduce a second
  brand palette.
- Route handlers are used where a browser must fire-and-forget (for example
  `keepalive` on `pagehide`); everything else uses server actions.
- All authenticated routes are `noindex`; keep that behaviour.

## CLA Bridge (native port)

The standalone `clabridge` app has been rebuilt inside LMS Core at `/bridge`.
It is a student tool (admins may inspect every level; teachers are refused).
The old external tab and `NEXT_PUBLIC_CLA_BRIDGE_URL` are gone — do not
reintroduce them.

- UI: `src/components/bridge/*`
- Domain logic: `src/lib/bridge/*` (combinations, scoring, target tables,
  progress/MAP planner, validation, bookmarklet, mark import)
- Reads: `src/lib/data/bridge.ts`
- Level selection: `src/lib/actions/bridge-actions.ts`
- Autosave: `src/app/api/bridge/estimate/route.ts`
- Legacy import: `scripts/migrate-clabridge.ts` stages Firestore students in
  `BridgeLegacyStudent`; `src/lib/bridge/claim.ts` claims a row on the first
  `/bridge` visit, because the standalone app used a different Firebase project
  and its UIDs are not `User.id`s
- Schema: `BridgeLevel`, `BridgeProfile`, `BridgeEstimate`,
  `BridgeLegacyStudent` in `prisma/schema.prisma`
- Migration: `scripts/migrate-clabridge.ts`
- Full port map, scoring rules and data mapping: `docs/clabridge-port.md`

Keep the scoring behaviour identical to the standalone app. If you change a
weight, a target column maximum or an import rule, update
`docs/clabridge-port.md` and add or adjust a test so the two implementations
cannot drift.

## Environment

The database is Neon, project `neon-amethyst-candle` (`floral-dust-66359032`,
`aws-us-east-1`). Get connection strings with the Neon CLI
(`neon connection-string --project-id floral-dust-66359032 [--pooled]`) or the
Neon MCP server; never commit them. `prisma.config.ts` accepts `DIRECT_URL`,
`DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING` or `DATABASE_URL` for
migrations.

Only `DATABASE_URL` is required to boot. Firebase, Pusher, object storage and
the AcademicBridge import degrade gracefully when their variables are absent.
`AUTH_DEV_MODE=true` signs in as a seeded user without Firebase credentials
and is hard-disabled in production.

File uploads live in Neon Object Storage, bucket `uploads`, declared in
`neon.ts` and provisioned with `neon deploy`. `neon env pull` writes the
AWS-standard `AWS_*` variables into `.env`; the app reads them when the
`S3_*` ones are absent (`src/lib/env.ts` → `getStorageConfig`). The bucket
is private, so reads go through the presigned URLs in
`src/lib/storage/s3.ts`. `npm run storage:test` proves the round trip.
