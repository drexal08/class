# CLA Bridge — native port notes

CLA Bridge was a standalone TanStack Start + Firebase app. It is now a native
LMS Core feature: same estimator, same scoring, but rendered with LMS Core's
slate UI and stored in PostgreSQL next to the rest of the LMS.

The standalone app remains the historical reference for behaviour. This
document records what moved where and which rules must not change.

## Routes and access

| Route | Purpose |
| --- | --- |
| `/bridge` | Level picker on first visit, then the estimator |
| `/bridge?level=S4\|S5\|S6` | Admin inspection of a specific level |
| `POST /api/bridge/estimate` | Autosave endpoint used by the estimator |

- Students pick a level once. `BridgeProfile.level` locks it; a later change is
  rejected by `setBridgeLevelAction` and the autosave route.
- Admins can switch levels and may write any level.
- Teachers are refused by both the page and the API. The navbar tab is only
  rendered for `STUDENT` and for administrators, whichever role they hold.
- A student's level is resolved from their profile even if they hand-edit
  `?level=`.

## Port map

| Standalone (`clabridge/src`) | LMS Core |
| --- | --- |
| `lib/combinations.ts` | `src/lib/bridge/combinations.ts` |
| `lib/scoring.ts` | `src/lib/bridge/scoring.ts` |
| `lib/target-table.ts` | `src/lib/bridge/target-table.ts` |
| `lib/progress.ts` | `src/lib/bridge/progress.ts` |
| `lib/marks-import.ts` | `src/lib/bridge/marks-import.ts` |
| `lib/marks-import-store.ts` | `src/lib/bridge/marks-import-store.ts` |
| `lib/marks-bookmarklet.ts` | `src/lib/bridge/marks-bookmarklet.ts` |
| `lib/saved-estimates.ts` | `src/lib/data/bridge.ts` + `src/lib/actions/bridge-actions.ts` + `src/app/api/bridge/estimate/route.ts` |
| `routes/_authenticated/estimate.$level.tsx` | `src/components/bridge/bridge-estimator.tsx` |
| `routes/_authenticated/levels.tsx` | `src/components/bridge/level-picker.tsx` |
| Firebase Auth | LMS Core session (`requireUser`) |
| Firestore | `BridgeProfile` / `BridgeEstimate` (Prisma/PostgreSQL) |

## Scoring rules

### Report percentage

Each subject mark is out of 100 and counts `weight` times:

```
percentage = Σ(clamped mark × weight) / Σ(weight)
```

Marks are clamped to 0–100. Empty or non-numeric marks are skipped, so the
gauge is a progressive estimate until every subject is filled. The current
overall average uses the same clamping, while targets stay strict: an
out-of-range target is treated as unset.

### Subject matrix

S4 and S5 share three streams:

- **MPCB** — Mathematics, Physics, Chemistry, Biology
- **MPEG** — Mathematics, Physics, Economics, Geography
- **HLPG** — History, Literature, Psychology, Geography (+ Subsidiary
  Mathematics; English is omitted because HLPG does not sit it)

Every core subject carries weight ×7. The common subsidiaries are
Entrepreneurship ×3, English ×3, General Studies ×3, ICT ×3 at S4/S5 (×2 at
S6) and Sports ×1. S4/S5 additionally include French ×3 and Kinyarwanda ×3.

S6 combinations:

- **MPG** — Mathematics, Physics, Geography
- **HGL** — History, Geography, Literature (+ Subsidiary Mathematics ×3)
- **MCB** — Mathematics, Chemistry, Biology
- **PCB** — Physics, Chemistry, Biology (+ Subsidiary Mathematics ×3)
- **HLP** — History, Literature, Psychology (+ Subsidiary Mathematics ×3)

### Assessment tables

Each subject exposes the same six columns, each capped at its own maximum:

| Column | Maximum | Meaning |
| --- | --- | --- |
| BOT | 100 | Beginning-of-term |
| CAT | 40 | Continuous assessment |
| GW | 10 | Group work |
| EUA | 50 | End-of-unit assessment |
| MT | 100 | Mid-term |
| EOT | 100 | End-of-term |

The full term is 400 points. Core subjects (weight ×7) render seven rows per
column; every other subject renders four.

- `columnAverage` averages the filled `got/total` ratios in a column and scales
  the result to the column maximum.
- `overallAverage` adds the earned column averages and divides by 400. A
  missing column contributes zero, which makes the number progressive.
- `recordedAverage` normalises by only the recorded columns, so a missing EOT
  does not drag the visible mark down before term end.
- `requiredEotAverage` answers “what EOT average reaches this term target?”
  from the other filled columns.

### Target planning

- Per-subject targets are plain marks out of 100.
- `targetAverage` and `markAverage` are weighted across filled subjects only.
- The MAP planner spreads a target across selected courses ordered hardest to
  easiest: the hardest course gets the lowest mark, the easiest the highest,
  and the weighted mean stays exactly on target. Edited marks stay fixed while
  the remaining courses rebalance; if the edits make the target unreachable the
  plan stops at 0/100 and reports the real weighted result.

## Data model

```prisma
enum BridgeLevel { S4 S5 S6 }

model BridgeProfile {
  userId   String @id
  level    BridgeLevel
  username String? @unique
  ...
}

model BridgeEstimate {
  id              String @id @default(cuid())
  userId          String
  level           BridgeLevel
  combinationCode String @default("")
  marks           Json @default("{}")
  targets         Json @default("{}")
  goalTargets     Json @default("{}")
  overallTarget   String?
  usefulnessRating Int?
  ...
  @@unique([userId, level])
}
```

The JSON columns keep the Firestore document shape (`marks`,
`targets`, `goal_targets`) so imported estimates render exactly as before.
`goalTargets` also accepts the legacy table-shaped targets; `normalizeGoals`
converts those to a single mark when they are loaded.

## Autosave

`BridgeEstimator` tracks the fields the tab actually edited and posts only
those fields to `/api/bridge/estimate` after a short debounce. It flushes on
`pagehide` and when the tab becomes hidden using `fetch(..., { keepalive: true })`,
which is why this is a route handler rather than a server action. A failed
save keeps the fields pending so the next flush retries them.

The API validates the payload with Zod (`src/lib/bridge/validation.ts`),
re-checks the student's level and upserts on `(userId, level)`.

## AcademicBridge import

The “Import my marks” bookmarklet is generated from
`src/lib/bridge/marks-bookmarklet.ts`. It opens AcademicBridge Grades, walks
every assessment page and posts `cla-bridge:import` messages to the estimator
tab, plus `cla-bridge:progress` messages while it works.

- `BridgeImportListener` is mounted in the root layout, so a payload that
  arrives during the sign-in redirect is still received.
- Payloads are staged in `sessionStorage` (`cla-bridge.pending-import`) and the
  bookmarklet is acknowledged immediately; the estimator applies the payload
  when it mounts.
- `importMarks` matches AcademicBridge course names to estimator subjects with
  aliases and fuzzy word matching, maps assessment labels onto the six columns,
  averages extra entries into the available rows and recomputes the subject
  mark from the merged table.
- Imported columns overwrite the matching table columns but never wipe a column
  the student entered by hand.

## Firestore → PostgreSQL migration

The standalone CLA Bridge ran on its own Firebase project, so its UIDs are not
LMS Core `User.id`s and those accounts cannot sign in here. The import therefore
runs in two steps, with an email address as the only join key:

1. `scripts/migrate-clabridge.ts` **stages** every Firestore student in
   `BridgeLegacyStudent`, keyed by lowercased email. No `User` row is needed,
   so students who have not registered yet keep their nickname, level and marks
   waiting.
2. `src/lib/bridge/claim.ts` **claims** that row the first time the student
   opens `/bridge`: it creates the `BridgeProfile` (level and nickname) plus any
   missing `BridgeEstimate` rows, then stamps `claimedAt`.

Source shape:

```
students/{firebaseUid}
  level, username, updated_at

students/{firebaseUid}/estimates/{s4|s5|s6}
  combination_code, marks, targets, goal_targets,
  overall_target, usefulness_rating, updated_at
```

Steps:

1. Apply the schema migration:

   ```bash
   npm run db:deploy
   ```

2. Point the script at the clabridge project with a service account:

   ```bash
   # raw JSON or base64-encoded JSON
   CLABRIDGE_SERVICE_ACCOUNT_KEY="..."
   # or a path to the JSON file
   CLABRIDGE_SERVICE_ACCOUNT_FILE="C:\path\clabridge-service-account.json"
   CLABRIDGE_PROJECT_ID="clabridge-d7e6f"
   ```

3. Dry run and inspect the summary:

   ```bash
   npm run db:migrate-clabridge
   ```

4. Stage the rows:

   ```bash
   npm run db:migrate-clabridge -- --apply
   ```

Claiming rules:

- Nicknames were already unique in clabridge (`^[a-z0-9_]{3,20}$`), so staging
  preserves all of them. If a handle is somehow taken when claiming, the
  estimates still land and the nickname is left unset rather than stolen.
- Claiming never overwrites an estimate the student has already edited here; it
  only fills gaps.
- A source document with **no level** (`ikaellordmercy@gmail.com`) still gets
  its three estimates, because estimates are keyed by level. The row stays
  unclaimed until the student picks a level; the visit right after that picks
  up the nickname too.
- The transaction gets a 20 s ceiling. Neon suspends an idle branch, and a
  cold start can otherwise eat Prisma's 5 s default before the first write.
- Already-claimed rows are skipped by re-runs, so the script is safe to repeat.
- A student who registers with a **different** email will not match. The staged
  row stays unclaimed until the address is fixed by hand — there is no admin UI
  for that yet.
- The one source document with no email on the document or the Auth user is
  skipped and reported.

### Migration status (2026-11-13)

Staged against the Neon project `neon-amethyst-candle` (`floral-dust-66359032`).

| Measure | Count |
| :-- | --: |
| clabridge student documents | 28 |
| staged rows | 27 |
| already had an LMS account | 1 |
| no LMS account yet | 26 |
| skipped — no email anywhere | 1 |

`byiringirinnocent8@gmail.com` was also imported directly before staging
existed: profile S6 (`@giant`) and three estimates. The remaining 18 students
with real marks and assessment tables keep them in `BridgeLegacyStudent` until
they sign in.

Do **not** invent `User` rows keyed by clabridge UIDs: those UIDs belong to
another Firebase project, and the email uniqueness constraint would then block
the real account from ever being created.

## Deliberate differences

- The green/gold clabridge branding is gone. The estimator uses LMS Core's
  slate palette; colour is reserved for semantic warning/danger states.
- The level picker is a first-class LMS page rather than a separate route.
- Admin level switching is an inspection tool; it is not exposed to students.
- The LMS Core database is the source of truth after migration. The standalone
  app is not written back to.
