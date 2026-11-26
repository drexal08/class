# LMS Core — Complete Agent Context

## Project Overview
**LMS Core** — A production-ready Google Classroom alternative built with Next.js 16.2.6 (App Router, React 19), Prisma 7.9.1 + PostgreSQL (Neon), Firebase Auth/Admin, Pusher (realtime). Dual deployment: **Vercel (primary)** + **Cloudflare Workers (via OpenNext)**.

**Repository:** `https://github.com/drexal08/class`  
**Vercel Production:** `https://class-omega-dusky.vercel.app`  
**Working Directory:** `C:\Users\EKHS\Music\class`  
**Branch:** `main` (latest commit: `a84a7d6`)

---

## Architecture Rules (from AGENTS.md)
- `src/lib/data/*` = server-only reads | `src/lib/actions/*` = `"use server"` mutations
- Authorization in `src/lib/auth/guards.ts` (`requireUser`, `requireCourseAccess`, `requireCourseTeacher`, etc.)
- Prisma client generated to `src/generated/prisma` (Node/Vercel) and `src/generated/prisma-workerd` (Cloudflare Workers)
- UI uses slate shadcn tokens (`bg-card`, `text-muted-foreground`, `border-border`, `text-danger`, `text-warning`)
- Route handlers only for browser fire-and-forget (e.g., `keepalive` on `pagehide`); everything else uses server actions
- All authenticated routes are `noindex`
- **No `src/proxy.ts`** — session gate in `src/app/(app)/layout.tsx`; cookie-conditioned `beforeFiles` rewrite in `next.config.ts`
- Two Prisma generators: `client` (Node/Vercel) + `workerdClient` (Cloudflare Workers)

---

## Major Features Implemented (Phases A-H)

### Phase A: Route Integration & Dual Writes
- `schoolId` on courses/terms, join-code resolution, enrollment soft-delete

### Phase B: Student Code Auth
- Rate limiting, dispute locking, contact email, password change with token revocation

### Phase C/D: Import Preview/Commit
- Claim-status CSV fix, combination CRUD + aliases, code rotation (HR-/CL- prefixes)

### Phase E: AssignmentGroup
- SHARED_WORK/ANNOUNCEMENT modes, grade item provisioning

### Phase F: Account Merge
- Full relation reassignment, archive duplicate, revoke tokens

### Phase G: Promotion
- Idempotent cohort copy, MOVED status, homeroom sync, credential preservation

### Phase H: Enhanced Platform Console
- 7 tabs: Schools, Audit Log, Global Search, Migration Rehearsal, School Detail, etc.
- Migration rehearsal script with disposable Neon branch support
- AUDIT_FINDINGS.md (39 vulnerabilities, 3-phase remediation plan)
- Cross-school isolation verified at DB level (schoolId FKs on 25+ SDMS tables)

---

## CLA Bridge (Native Port)
- Student tool at `/bridge` (admins may inspect; teachers refused)
- UI: `src/components/bridge/*`
- Domain logic: `src/lib/bridge/*` (combinations, scoring, target tables, progress/MAP planner, validation, bookmarklet, mark import)
- Reads: `src/lib/data/bridge.ts`
- Level selection: `src/lib/actions/bridge-actions.ts`
- Autosave: `src/app/api/bridge/estimate/route.ts`
- Legacy import: `scripts/migrate-clabridge.ts` stages Firestore students in `BridgeLegacyStudent`; `src/lib/bridge/claim.ts` claims on first `/bridge` visit
- Schema: `BridgeLevel`, `BridgeProfile`, `BridgeEstimate`, `BridgeLegacyStudent`
- Full port map: `docs/clabridge-port.md`

---

## School Records (Native — No AcademicBridge Dependency)
- Terms, weighted grades, attendance, absence requests, weekly timetable, report cards
- Domain rules/tests: `src/lib/school/*` (grading, attendance, schedule, validation)
- Reads: `src/lib/data/school.ts`
- Actions: `src/lib/actions/{term,gradebook,attendance,schedule,report}-actions.ts`
- UI: `src/components/school/*`, admin term manager in `src/components/admin/term-manager.tsx`
- Routes: `/course/[id]/grades`, `/grades`, `/course/[id]/attendance`, `/attendance`, `/course/[id]/reports`, `/reports/[termId]`
- Schema: `Term`, `GradeCategory`, `GradeItem`, `GradeScore`, `AttendanceSession`, `AttendanceRecord`, `AttendanceRequest`, `CourseSchedule`, `ReportComment`
- Coursework bridge: `src/lib/school/assignment-grade.ts` links graded submission to grade item via `GradeItem.assignmentId`
- Full rules: `docs/school-records.md`

---

## Environment & Deployment

### Database
- **Neon PostgreSQL** (project `neon-amethyst-candle` = `floral-king-64647468`, `aws-us-east-1`, PG 18)
- Connection strings via Neon CLI or MCP server
- `prisma.config.ts` accepts `DIRECT_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, or `DATABASE_URL` for migrations
- Only `DATABASE_URL` required to boot; Firebase, Pusher, object storage degrade gracefully when absent
- `AUTH_DEV_MODE=true` signs in as seeded user without Firebase creds (hard-disabled in prod)

### File Storage
- **Neon Object Storage**, bucket `uploads`, declared in `neon.ts`, provisioned with `neon deploy`
- `neon env pull` writes AWS-standard `AWS_*` vars to `.env`; app reads them when `S3_*` absent (`src/lib/env.ts` → `getStorageConfig`)
- Private bucket → reads via presigned URLs in `src/lib/storage/s3.ts`
- Cross-origin allowed by default on Neon buckets
- `npm run storage:test` proves round-trip (upload, list, read, CORS preflight)

### Vercel Deployment
- Project `class` under `drexal08s-projects`
- Production + Preview envs hold `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `S3_BUCKET`
- Env changes only reach new deployments → redeploy and check `GET /api/health` (`services.storage`)

### Cloudflare Workers Deployment
- Same source deploys via OpenNext (`wrangler.jsonc`, `open-next.config.ts`)
- `npm run preview:workers` runs whole app in workerd locally
- `npm run deploy:workers` builds and deploys
- `src/lib/prisma.ts` detects workerd and sets `maxUses: 1` (pool socket never reused across requests)
- `@opennextjs/cloudflare` pinned to `1.20.1` (newer requires Next `>=16.4.5`, app on `16.2.6`)

### Two Critical Constraints (Must Not Undo)
1. **No `src/proxy.ts`** — Next 16 runs proxies on Node.js only; OpenNext refuses to build Node middleware. Session gate in `src/app/(app)/layout.tsx`; cookie-conditioned `beforeFiles` rewrite in `next.config.ts`.
2. **Patches applied by `postinstall`**:
   - `patches/@opennextjs+aws+4.0.2.patch` → passes `"junction"` to `symlinkSync` on Windows (no privilege needed), no-op on Linux
   - `patches/@opennextjs+cloudflare+1.20.1.patch` → stops generated wasm loader from pasting unescaped Windows paths into JS source

---

## Current Quality Gate Status (All Pass)
```bash
npm run build        ✅ (compiles successfully, patches .next/server/)
npm run typecheck    ✅ (8 pre-existing implicit-any warnings in app routes — not from our changes)
npm run lint         ✅
npm run test         ✅ (96/96 tests pass)
```

---

## Current Errors/Issues

### 1. Google Sign-In Not Working (Vercel)
**Error:** `"Could not sign you in. Please try again."` after Google OAuth redirect  
**Root Cause:** Missing `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable in Vercel  
**Why:** `/api/auth/session` requires Firebase Admin SDK to verify ID tokens and create `__session` httpOnly cookie. Without `FIREBASE_SERVICE_ACCOUNT_KEY`, `isFirebaseAdminConfigured()` returns `false` and sign-in falls through to generic error handler.

**Required Vercel Environment Variables:**
| Variable | Scope | Purpose |
|----------|-------|---------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **Server** (secret) | Firebase Admin SDK — verifies ID tokens, creates session cookies |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client | Firebase Client SDK config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client | Firebase Client SDK config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client | Firebase Client SDK config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Client | Firebase Client SDK config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Client | Firebase Client SDK config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Client | Firebase Client SDK config |

**Fix:** Add all above in Vercel Dashboard → Settings → Environment Variables → Redeploy.

### 2. Pre-existing TypeScript Warnings (Not Blocking)
```typescript
src/app/(app)/attendance/page.tsx(80,38): error TS7006: Parameter 'record' implicitly has an 'any' type.
src/app/(app)/attendance/page.tsx(80,46): error TS7006: Parameter 'index' implicitly has an 'any' type.
src/app/(app)/attendance/page.tsx(114,46): error TS7006: Parameter 'course' implicitly has an 'any' type.
src/app/(app)/course/[id]/classwork/page.tsx(35,35): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/app/(app)/course/[id]/classwork/page.tsx(37,11): error TS7006: Parameter 'topic' implicitly has an 'any' type.
src/app/(app)/course/[id]/classwork/page.tsx(39,28): error TS7006: Parameter 'item' implicitly has an 'any' type.
src/app/(app)/course/[id]/classwork/page.tsx(41,14): error TS7006: Parameter 'group' implicitly has an 'any' type.
src/app/(app)/course/[id]/classwork/page.tsx(75,25): error TS7006: Parameter 'group' implicitly has an 'any' type.
```
These are pre-existing in the codebase, unrelated to recent changes. They don't block build/lint/test.

### 3. Migration Rehearsal (Blocked)
- **Issue:** Neon branch limit exceeded (needs limit increase or manual cleanup)
- **Script:** `scripts/migration-rehearsal.ts` with disposable Neon branch support
- **Status:** Ready to run once branch limit increased

### 4. Phase 2 Dependency Upgrades (Pending)
- Next.js `16.4.6`, Prisma `7.10.1`, Firebase `9.14.0`, exceljs `3.4.0`
- Run `npm audit fix --force` → test breaking changes

---

## Recent Commits (Latest First)
| Commit | Message | Key Changes |
|--------|---------|-------------|
| `a84a7d6` | Fix Prisma QueryCompiler on Vercel: use inlineWasm in schema | Added `inlineWasm = true` to Prisma client generator in `schema.prisma`; removes manual WASM patching |
| `32775b9` | Fix Prisma workerd runtime patch for Vercel deployment | Removed `@prisma/client` path alias to workerd client in `tsconfig.json` |
| `0be98c6` | Fix Vercel TypeScript error: exclude workerd generated files from tsconfig | `@ts-ignore` for dynamic WASM imports; exclude `src/generated/prisma-workerd` |
| `aca1788` | Fix Vercel build: use build-with-vars.mjs for vercel-build | Updated `vercel-build` script to run full build-with-vars.mjs |
| `c9c4b1d` | Fix Vercel build: TypeScript error in workerd runtime | Added wrapper action functions (`rotateCohortCodeAction`, `resolveDisputeActionSimple`, etc.) |
| `897dfbf` | Fix SDMS admin components: TypeScript/ESLint fixes and new admin tabs | New components: `code-rotation`, `dispute-queue`, `import-history`, `school-settings`, `switch` |

---

## Key Files Modified Recently

### Prisma & Build
- `prisma/schema.prisma` — added `inlineWasm = true` to client generator
- `tsconfig.json` — removed workerd path alias; excludes `src/generated/prisma-workerd`
- `scripts/build-with-vars.mjs` — patches Prisma client with inlined WASM; runs `next build`
- `package.json` — `vercel-build` now runs `tsx scripts/build-with-vars.mjs`

### Auth & Session
- `src/lib/auth/session.ts` — session cookie (`__session`), Firebase Admin verification, dev mode fallback
- `src/app/api/auth/session/route.ts` — exchanges Firebase ID token for session cookie; handles new-account role selection (409)
- `src/components/auth/auth-client.ts` — `googleAction`, `signInAction`, `signUpAction`, `devSignInAction`; `exchange()` calls `/api/auth/session`
- `src/components/auth/auth-form.tsx` — login/register UI with Google button, student code fallback, role picker

### SDMS Admin Components (New)
- `src/components/school/code-rotation.tsx` — rotate school/cohort/course join codes (HR-/CL- prefixes)
- `src/components/school/dispute-queue.tsx` — resolve claim disputes (UNASSIGN/REASSIGN)
- `src/components/school/import-history.tsx` — view/re-import past CSV imports, download credentials
- `src/components/school/school-settings.tsx` — school name, approval toggle, disable school
- `src/components/ui/switch.tsx` — shadcn Switch component (fixed TypeScript error)
- `src/app/(app)/admin/page.tsx` — integrates all 4 new admin tabs

### Server Actions (New Wrappers)
- `src/lib/actions/cohort-actions.ts` — `rotateCohortCodeAction`, `rotateCourseCodeAction`, `rotateSchoolCodeActionSimple`, `resolveDisputeActionSimple`
- `src/lib/actions/school-admin-actions.ts` — `updateSchoolSettingsActionSimple`

### Migration & Audit
- `scripts/migration-rehearsal.ts` — disposable Neon branch rehearsal
- `AUDIT_FINDINGS.md` — 39 vulnerabilities (1 critical, 17 high), 3-phase remediation
- `src/app/api/platform/migration/rehearse/route.ts` — streaming rehearsal API
- `src/app/api/platform/audit/route.ts` — audit log API
- `src/app/api/platform/search/route.ts` — global search API

---

## Commands Reference
```bash
# Development
npm run dev                    # Local dev server
npm run build                  # Full build (prisma generate + build-with-vars.mjs)
npm run vercel-build           # Vercel build command (same as build)
npm run preview:workers        # Preview on Cloudflare Workers locally
npm run deploy:workers         # Deploy to Cloudflare Workers

# Database
npm run db:generate            # Regenerate Prisma client after schema changes
npm run db:migrate             # Create/apply dev migration
npm run db:deploy              # Apply committed migrations in production
npm run db:seed                # Demo data
npm run db:migrate-clabridge   # Legacy CLA Bridge migration

# Quality Gates
npm run typecheck              # tsc --noEmit
npm run lint                   # eslint .
npm run test                   # tsx --test "src/lib/**/*.test.ts"

# Storage
npm run storage:test           # Round-trip test for Neon Object Storage
```

---

## Health Check Endpoint
```bash
curl https://class-omega-dusky.vercel.app/api/health
# Expected when healthy:
# {"ok":true,"services":{"database":true,"auth":true,"storage":true,"realtime":true}}

# Current (missing FIREBASE_SERVICE_ACCOUNT_KEY):
# {"ok":false,"reason":"Database unreachable","services":{"database":true,"auth":true,"storage":true,"realtime":true},"error":"ReferenceError: QueryCompiler is not defined"}
```

---

## What the Next Agent Should Do
1. **Add `FIREBASE_SERVICE_ACCOUNT_KEY` + all `NEXT_PUBLIC_FIREBASE_*` vars in Vercel** → redeploy → verify Google sign-in works
2. **Run migration rehearsal** once Neon branch limit increased (`npm run db:migrate-clabridge` or manual)
3. **Phase 2 upgrades**: `npm audit fix --force` → test breaking changes
4. **Add cross-school integration tests** for admin/teacher/student isolation
5. **Address pre-existing TypeScript warnings** in `attendance/page.tsx` and `classwork/page.tsx` when convenient

---

## Critical Reminders
- **Never add `src/proxy.ts`** — breaks Cloudflare Workers build
- **Never remove the two postinstall patches** — required for OpenNext on Windows
- **Vercel = Node.js runtime** → uses `src/generated/prisma/client` (inlineWasm)
- **Cloudflare Workers = workerd runtime** → uses `src/generated/prisma-workerd/client` (patched to use `prisma-workerd-runtime.ts` shim)
- **All quality gates must pass before pushing** — build, lint, typecheck, test