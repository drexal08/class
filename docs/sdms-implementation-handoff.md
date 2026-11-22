# SDMS implementation handoff

Date: 2026-11-21
Project: `C:/Users/EKHS/Music/class`
Status: **in progress — not ready to deploy or migrate production**
Original feature plan: SDMS import, cohort login, school tenancy, class-wide work, account merging and promotion.

This document is the continuation brief for another agent. It distinguishes code that exists from integration that is actually complete. Do not treat the presence of a model/helper/component as proof of a working end-to-end feature.

---

## 1. Current verified baseline

Checks run against the current working tree:

| Check | Result |
|---|---|
| `npx prisma validate` | Passed |
| `npx prisma generate` | Passed for Node and workerd clients |
| `npm run typecheck` | Passed |
| `npm run lint -- --quiet` | Passed |
| `npm test` | **96 tests passed, 0 failed** |
| Real workbook parse | **49 rows, 3 cohorts, 0 errors** |
| Production build | Not run after the latest changes |
| Disposable-database migration rehearsal | **Not run** |
| Production migration | **Not applied** |
| Vercel/Worker deployment | **Not run** |
| Browser/end-to-end smoke test | **Not run** |

Real workbook result, with names/codes suppressed:

- `S4 MS2`: 10 students, gender present.
- `S4 MS1`: 13 students, no gender column; gender remains unset with a warning.
- `S4 A&H`: 26 students, gender present.
- Academic year `2026/2027` is inherited by sheets that omit it when the workbook has exactly one explicit year.

### Important working-tree warning

The tree mixes SDMS work, Cloudflare/WASM work and parallel TypeScript fixes. Do not reset it or start over. Review changes before committing. In particular:

- Many existing files were modified by parallel work.
- There are numerous untracked `check-patch*.js` and bundle-patching scripts that are not part of SDMS. Do not commit them blindly and do not delete another agent's work without checking.
- `.dev.vars` is modified and may contain secrets. Never commit it or copy its values into documentation, logs, tests or chat.
- `exceljs@4.4.0` was installed. Its installation reported **39 dependency-tree vulnerabilities (1 low, 20 moderate, 17 high, 1 critical)**. Run and assess `npm audit`; do not use `audit fix --force`.

---

## 2. Implemented — database and migration

### Expanded Prisma schema

`prisma/schema.prisma` now contains:

- New enums: `PlatformRole`, `SchoolRole`, `SchoolMemberStatus`, `Gender`, `MemberStatus`, `CourseKind`, `JoinCodeKind`, `PasswordPolicy`.
- New models: `School`, `SchoolMember`, `SchoolInvite`, `JoinCode`, `Combination`, `CombinationAlias`, `Cohort`, `CohortMember`, `ImportPreview`, `CohortImport`, `AuthIdentity`, `ClaimDispute`, `AssignmentGroup`, `LoginAttempt`, `AuditEvent`.
- `User` additions: globally unique `studentCode`, `nameAsImported`, `gender`, `platformRole`, `contactEmail`, `authKind`, `passwordOverridden`, `lastSignInAt`, `archivedAt`.
- `Course` additions: nullable `schoolId`, nullable `cohortId`, `kind`.
- `Term.schoolId`, initially nullable.
- `Enrollment.active` and `Enrollment.leftAt`, preserving historical rows when access ends.
- `Assignment.groupId` and `Assignment.overrides`.
- Unique assignment-group copies through `(groupId, courseId)`.
- Password override state belongs to `User`, not to a cohort membership that is recreated during promotion.
- `CohortMember.lastSignInAt` supports claim-status exports.
- `AuthIdentity` is keyed by provider + Firebase project + UID, not by sign-in method.

### Migration written but not applied

`prisma/migrations/20261121230000_sdms_expand/migration.sql` includes:

- Additive tables and nullable tenant columns.
- School-scoped term uniqueness.
- Partial unique index allowing only one homeroom per cohort.
- One permanent join code per school/cohort/course.
- Idempotent Legacy-school creation and course/term backfill.
- Legacy staff memberships and audit metadata.

The migration deliberately does **not** make tenant columns non-nullable. Vercel runs migrations before building the new release; old code must keep working during that window.

Before using this migration, establish the **actually deployed migration baseline**. It was generated from `HEAD`, which is not proof of the production state. Rehearse the full migration sequence on a disposable production-shaped database.

---

## 3. Implemented — workbook parser and normalization

Files:

- `src/lib/sdms/import-normalization.ts`
- `src/lib/sdms/import-normalization.test.ts`
- `src/lib/sdms/workbook-parser.ts`
- `src/lib/sdms/workbook-parser.test.ts`
- `scripts/inspect-sdms-workbook.ts`

Behavior implemented:

- `.xlsx` parsing with ExcelJS; legacy `.xls` is rejected with an instruction to save as `.xlsx`.
- 8 MB compressed-file cap, 64 MB expanded-archive cap, 100-sheet cap, 100,000-cell cap and 2,000-student-row cap.
- Metadata discovery by labels (`school`, `grade`, `combination`, `class`, `academic year`), not fixed positions.
- Table/header discovery by aliases rather than column letters.
- Correct sparse-sheet traversal using `worksheet.rowCount`, not `actualRowCount`.
- Codes remain strings, are whitespace-stripped and uppercased; synthetic email local parts are lowercased.
- Raw imported names and normalized display names are separate.
- Duplicate-code detection across sheets with source locations.
- Row errors include sheet, row and cell address.
- Missing gender **column** is allowed with a warning and `gender = null`. If a gender column exists, invalid/blank values remain hard row errors.
- Academic year is inherited when exactly one explicit year exists in the workbook.
- Unknown/no-table sheets are skipped with warnings.
- Real student workbook is not committed. Synthetic tests reproduce its layout variants.

`defaultCohortPassword()` exists, but provisioning does not yet use it. This is not evidence that cohort authentication is complete.

---

## 4. Implemented — identity, sessions and claim enforcement

Files:

- `src/lib/auth/identity.ts`
- `src/lib/auth/claim.ts`
- `src/lib/auth/session.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/api/auth/landing/route.ts`
- `src/app/(app)/layout.tsx`
- `src/lib/auth/guards.ts`
- `src/lib/types.ts`

Implemented behavior:

- Canonical Firebase identity resolution is shared by session-cookie lookup and ID-token exchange.
- Alternate Firebase UIDs resolve through `AuthIdentity`; primary `User.id` is never rewritten.
- Identity creation is race-aware and rejects UID conflicts.
- Archived accounts and identity conflicts cannot silently create replacement accounts.
- Imported code accounts never self-select a teacher role or see the new-account role picker.
- Secondary Google identities cannot overwrite the canonical synthetic email.
- `SUPERUSER_EMAILS` bootstraps `platformRole = SUPERUSER` only for verified matching email addresses. Removing an address does not automatically demote.
- Superuser is **not** stamped into global `User.isAdmin`; platform privilege and legacy global administration are separate.
- Successful Firebase exchange updates user/cohort `lastSignInAt`.
- `getCurrentUser()` enforces unclaimed-cohort checks by default. The app layout opts out only so it can redirect to `/welcome`.
- Server Actions using `requireUser()` inherit the claim check; this is not merely a layout redirect.
- Landing decisions account for `/platform`, `/welcome` and `/dashboard`.

### Immediate integration gap

`/welcome` and `/platform` routes are **not created yet**, although landing/layout logic can point to them. Create them before exercising imported-student or superuser flows.

Dispute locking is not implemented: an unresolved dispute does not yet block repeated sign-in/dispute attempts.

`destroySession()` does not yet revoke sessions for every linked UID.

---

## 5. Implemented — school tenancy and course guards

Files:

- `src/lib/sdms/access.ts`
- `src/lib/actions/school-admin-actions.ts`
- `src/lib/data/school-admin.ts`
- `src/lib/sdms/codes.ts`
- `src/lib/sdms/codes.test.ts`

Implemented helpers/mutations:

- `requireSuperuser`, explicit `schoolId` membership/admin guards, cohort read/owner/manager guards, active cohort-student guard.
- Superusers do not silently inherit school-roster access.
- School creation with a permanent `SCH-XXXXXXXX` code.
- School-admin appointment, school disable/enable, teacher join requests, approval/rejection and promotion to school admin.
- Audit events for school/admin/review mutations.
- Platform school structure/count reads and school/cohort admin reads.
- Claim-status CSV helper exists, but no download route yet.
- Join-code generation uses eight unambiguous characters and kind prefixes.

Course authorization/read changes:

- Disabled schools block course access.
- School admins receive school-scoped course management access.
- LEFT/MOVED/inactive enrollments no longer grant current-course entry.
- Dashboard/archived/roster reads respect active enrollment and school state.
- Legacy seven-character course codes still exist.

These rules need direct cross-school integration tests, not just type checking.

---

## 6. Implemented — school UI components, but pages are not wired

Created:

- `src/components/school/platform-console.tsx`
- `src/components/school/join-school-form.tsx`
- `src/components/school/school-teacher-manager.tsx`

These compile and lint, but are not yet rendered by routes and have not been browser-tested.

Still to create:

- `(app)/platform/page.tsx`
- `(app)/join-school/page.tsx`
- New school-scoped `(app)/admin/page.tsx`
- `(app)/legacy-admin/page.tsx` for the existing global directory, terms and CLA Bridge tools
- Cohort detail/import/roster/disputes/duplicates pages

The existing `(app)/admin/page.tsx` is still the old institution-wide page. Do not delete its functionality; move it to `/legacy-admin` while `/admin` becomes the school console.

---

## 7. Prisma runtime correction

Files:

- `src/lib/lazy-client-proxy.ts`
- `src/lib/lazy-client-proxy.test.ts`
- `src/lib/prisma.ts`

The previous async property getter made `prisma.user` a Promise and broke normal model access. A two-level lazy proxy now keeps model access synchronous and loads the runtime-specific client only when a method is invoked. The proxy test covers concurrent model calls and `$transaction`.

Node/Vercel uses `@/generated/prisma/client`; the Workers branch uses the aliased `@prisma/client`. This is a runtime code correction, **not proof that either deployment is healthy**. Cloudflare/WASM work remains separately modified and must be verified independently.

---

## 8. Required design corrections — preserve these decisions

The original draft must not be followed literally where it conflicts with these corrections:

1. **Migration order:** nullable expansion → backfill → dual-writing deployment → zero-orphan verification → separate constraint-enforcement release. No same-release non-null tenant requirement.
2. **Tenancy:** courses and terms require direct school ownership. Other school records inherit tenancy through their course; users remain global identities with multiple possible school memberships.
3. **Platform privilege:** never equate superuser with global `isAdmin`. School admins must not mutate global roles or read other schools.
4. **Identity:** resolve `AuthIdentity` during both sign-in and session lookup. Firebase UID + project is the identity key; Google/password are sign-in methods, not separate UID namespaces.
5. **Claims:** enforce centrally as well as in layout. Add unresolved-dispute locking.
6. **Passwords:** ordinary roster re-import must not reset personal passwords, overwrite claimed profiles or re-enable disabled Firebase users. Rotation is a separate explicit action.
7. **Predictable shared passwords:** `Cla@<year>` plus a classmate's code is not proof of identity. The preferred production flow is unique one-time activation secrets and mandatory personal password establishment before private data is exposed. If the cohort-password workflow remains, it is temporary-only with `mustChangePassword` and claim enforcement.
8. **Recovery:** an unverified optional contact email is not an account-recovery mechanism. Add verified recovery or a documented admin-assisted reset path.
9. **Import previews:** use a 30-minute server-side `ImportPreview` with hashed opaque token and unique commit key. Do not put student rows or plaintext passwords into a signed client token. Do not store plaintext password overrides in the preview payload; request the override again at commit if needed.
10. **Terms:** terms and active-term selection must be school-scoped, including lazy assignment-grade item creation and reports.
11. **Enrollment history:** mark inactive/left rather than deleting rows that anchor grades and submissions. Current policy blocks the former student's course access while preserving teacher-side history.
12. **Announcements:** school/stream announcements must use `Announcement`, not `Assignment(type = MATERIAL)`, because the stream reads only announcements.
13. **Grouped work:** enforce one copy per course, preserve per-class overrides, and never delete/recreate scored rubric criteria during group edits.
14. **Merging:** unverified contact email can suggest duplicates but cannot prove ownership. Moving only submissions is insufficient.
15. **Fixtures:** do not commit the real workbook or real student names/codes.

---

## 9. Remaining work — implement in this order

### Phase A — finish route integration and dual writes (highest priority)

1. Create `/platform`, `/join-school`, new school `/admin`, `/legacy-admin`, `/welcome` routes and navigation.
2. Preserve existing global admin/CLA Bridge behavior under `/legacy-admin`.
3. Add school selection for users administering multiple schools.
4. Update independent course creation to resolve and write `Course.schoolId`; multi-school teachers must explicitly choose a school.
5. Update term creation/list/activation to write and query `Term.schoolId`. Scope gradebook/report/active-term reads accordingly.
6. Update join-code resolution for `SCH-`, cohort/course `CLS-` and legacy seven-character course codes.
7. Change independent course removal/leave from deleting enrollments to `active = false, leftAt = now`; rejoining reactivates safely. Cohort-managed removal must go through cohort membership logic.
8. Ensure filtered counts use active enrollments where the UI means current students.
9. Add explicit DTOs when wiring `listPlatformSchools()` into the page; do not rely on broad `unknown` mapping.

### Phase B — student-code authentication and claim UI

1. Add `/api/auth/student-code` using **server-mediated Firebase Identity Toolkit `signInWithPassword`**. Browser-only Firebase sign-in cannot provide trusted DB-backed failed-attempt limiting.
2. Reuse the existing `signInWithFirebase()` exchange and the same `__session` cookie. Do not add a second cookie/session path.
3. Normalize code identically at import and login. Return one generic error: `Code or password is incorrect.`
4. Add HMAC-hashed code/IP `LoginAttempt` records using a new `SDMS_SECRET`; never log plaintext codes, passwords or raw IPs.
5. Enforce 5 failures/15 minutes per code and 20/15 minutes per IP with exponential lockout. Use trusted proxy IP headers and generic lockout responses.
6. Add the code-login UI without a role picker and without Firebase error details that enable enumeration.
7. Build `/welcome`: show only code/name/class/combination/school/year. Confirm sets `claimedAt` and hashed IP. Dispute creates a dispute, locks repeated attempts, notifies owner/admin and signs out.
8. Add optional/skippable contact email after claim; never treat it as an auth credential.
9. Implement password change with reauthentication, `User.passwordOverridden`, revocation across all linked UIDs and a fresh current-session cookie. Document/test the recovery path.
10. Prefer Firebase `linkWithCredential` for Connect Google. Use the explicit merge queue for already-separated accounts.

### Phase C — import preview and provisioning

1. Add route handlers for workbook preview and commit; retain the 8 MB/row limits.
2. Build the preview diff against DB state: creates, renames, moves, conflicts, absentees and unresolved combinations.
3. Globally unique student codes are the identity. Duplicate names are allowed.
4. A code in another school is a hard error. A code in another active cohort requires explicit move/leave/abort resolution.
5. Absentees become LEFT only after explicit confirmation that the sheet is a complete roster; never delete them.
6. Support combination creation and normalized aliases. Do not rely on the string array for uniqueness.
7. Provision Firebase users in batches of five; adopt existing synthetic-email users idempotently. Do not re-enable disabled users or reset passwords during ordinary re-import.
8. In one DB transaction per cohort, upsert User/Cohort/CohortMember/CombinationAlias, create the homeroom course and teacher enrollment, issue cohort/course codes, write `CohortImport` and `AuditEvent`.
9. Implement `syncCohortEnrollments(cohortId)` with active/inactive states and teacher enrollments.
10. Revalidate all conflicts at commit and serialize reconciliation per cohort. Test concurrent/repeated commits with identical final counts.
11. Store per-row outcomes; do not call the current design resumable until it really is.
12. Build import UI and history. Credential CSV is generated once for the admin and not persisted with plaintext passwords.
13. Implement explicit credential rotation separately; only users who have not overridden their password are eligible.

### Phase D — cohort administration

- Cohort detail/roster and active status.
- Move/mark-left with synchronized enrollment state.
- Dispute queue and admin unclaim/reassign.
- Re-import and import history.
- Claim-status CSV route with correct authorization and `Content-Disposition`.
- Correct the CSV contract: current helper emits `${claimState}/${member.status}` in one status column. Match the required `CLAIMED | UNCLAIMED | DISPUTED` contract or add a separate membership-status column.
- Combination CRUD and alias management.
- Cohort/course code rotation; school codes remain permanent.
- School settings that do not allow privilege escalation.

### Phase E — class-wide work and grading

1. Announcement mode creates grouped `Announcement` copies, no marks and no `GradeItem`. Add a grouping relation if group editing requires it.
2. Shared-work mode validates every target and atomically creates one assignment per course under an `AssignmentGroup`.
3. Explicitly select/provision the school-scoped term, category and assessed date. Extract/reuse an `ensureAssignmentGradeItem` helper; one grade item per course copy.
4. Publish/notify per course after commit.
5. Preserve per-class overrides. Target removal archives rather than deleting graded work.
6. Do not replace rubric criteria that already have scores.
7. Update teacher “To grade” to aggregate by group with per-class progress.

### Phase F — account merge

- Require identity proof; never auto-merge by name or unverified email.
- Handle every user-owned relation and compound uniqueness constraint: submissions, enrollments, attendance, grade scores, reports, comments, attachments, notifications, cohort/school membership, identities and CLA Bridge data.
- Make the transaction conflict-aware and reversible until archival.
- Disable duplicate identities/sessions without losing audit history.

### Phase G — promotion

- Create/reuse destination cohort and homeroom.
- Copy active memberships idempotently; old memberships become MOVED.
- Synchronize old/new enrollment activity without deleting history.
- New seed year applies only to newly provisioned users or explicit later rotation; never reset existing credentials merely because promotion occurred.

### Phase H — rehearsal and release verification

1. On disposable production-shaped data, apply the full migration history and this expansion twice where safe; verify idempotent backfill and zero orphans.
2. Verify old code can still create courses/terms during the migration-before-build window.
3. Verify new code dual-writes tenant IDs before any later `NOT NULL` enforcement.
4. Test rollback and old-client reads/writes.
5. Add cross-school tests for every course, cohort, term, import, merge and assignment-group operation.
6. Test unclaimed users against direct Server Actions/APIs, secondary UID sign-in, identity conflict, disabled users/schools, claim disputes and password revocation.
7. Test repeated/concurrent imports and grouped-work creation.
8. Run `npm run typecheck`, lint, all tests, production build, Vercel build path and Worker build/dry-run separately. Schema validation is not deployment verification.
9. Assess `npm audit` findings and ExcelJS transitive deprecations before release.
10. Ship Vercel first. Do not assume the Cloudflare/WASM path is healthy without its own runtime health check.

---

## 10. Environment/documentation still required

Add to `.env.example`, `SETUP.md`, deployment docs and build-variable configuration without writing real secrets:

- `NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN`: permanent, deployment-global synthetic domain. Changing it requires migration/re-provisioning.
- `SUPERUSER_EMAILS`: comma-separated verified Google emails used for initial platform bootstrap.
- `SDMS_SECRET`: strong random secret for HMAC hashing of login attempts and other SDMS secrets.
- Reuse the existing public Firebase API key for server-mediated Identity Toolkit password verification.

Document that production code login should be disabled with a clear configuration message if required SDMS/Firebase configuration is absent.

---

## 11. Definition of done

Do not report the feature complete until all are true:

- Superuser creates a school and appoints an admin; the admin approves teachers using a permanent school code.
- Cross-school reads/writes fail in direct route/action tests.
- The sample workbook imports 49 students into three cohorts; re-import and concurrent retries create no duplicates and do not reset personal credentials.
- A student can securely activate/sign in, confirm identity, dispute a mismatch, optionally add contact information and establish/change a personal password with a recovery path.
- Unclaimed or disputed students cannot bypass the gate through Server Actions or APIs.
- Announcement copies appear in the intended streams with no marks.
- Shared work reaches only selected classes and creates independent grade items; grading one class never appears in another.
- Merge preserves every related record and revokes duplicate access.
- Promotion preserves accounts, submissions, grades, attendance and reports without credential resets.
- Claim-status CSV matches its documented schema and authorization.
- Legacy backfill has zero orphans and old-client compatibility is proven.
- Typecheck, lint, tests, production build and migration rehearsal pass; deployment health is verified separately.

---

## 12. Instructions for the next agent

1. Read `AGENTS.md` and this handoff before editing.
2. Continue from the current tree; do not regenerate the schema or parser from scratch.
3. Preserve parallel Cloudflare/TypeScript work and keep secrets out of Git.
4. Use TDD for authorization, import, authentication, fan-out, merge and promotion.
5. Run long shells in the background and continue independent work while they finish.
6. Start with Phase A route wiring and tenant dual-writes; the current landing logic can reference routes that do not yet exist.
7. Do not apply the migration to production or deploy without an explicit request and a disposable-database rehearsal.
