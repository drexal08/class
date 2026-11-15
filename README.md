# LMS Core

A production-ready Google Classroom alternative — classes, a discussion stream,
classwork with rubrics, submissions, grading and a gradebook.

Built for **focus over flourish**: a calm slate palette, generous whitespace and
micro-interactions only. Colour is reserved for status a student must notice.

```bash
npm install
cp .env.example .env      # add a DATABASE_URL
npm run db:migrate && npm run db:seed
npm run dev
```

Full walkthrough in **[SETUP.md](./SETUP.md)**.

---

## Stack

| Layer | Choice |
| :-- | :-- |
| Framework | Next.js 16 (App Router, Server Actions), React 19, TypeScript strict |
| Styling | Tailwind CSS v4, shadcn/ui, Lucide icons, Inter |
| Auth | Firebase Auth (Google + Email/Password) + Firebase Admin session cookies |
| Database | PostgreSQL (Neon) via Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| Storage | Neon Object Storage (S3-compatible) / R2 / AWS S3 via presigned `PUT` |
| Real-time | Pusher private channels, with a polling fallback |
| Hosting | Vercel |

## Features

**Classes** — create, archive and restore; 7-character join codes with copy and
reset; shareable invite links; roster management with per-student mute and
removal; class description and stream post policy.

**Stream** — announcements with attachments, pinning, threaded class comments,
teacher moderation.

**Classwork** — Assignments, Quizzes, Questions and Material; topics; due dates;
point values; drafts; optional rubrics.

**Submissions** — text responses and file attachments, turn in / unsubmit,
automatic `LATE` state against the due date.

**Grading** — a split-screen workspace with the roster and the student's work on
the left, and grade, rubric breakdown and private comments on the right.
`j`/`k` move between students. Return work individually or in bulk.

**Grades** — a live gradebook with class averages, per-student overall
percentages and CSV export. Students see only their own grades.

**Across classes** — a to-do list (assigned / missing / done for students, a
review queue for teachers), a calendar of everything due, and a notification
feed.

**CLA Bridge** — a native report estimator tab for students and admins, with
combination-aware weighting, assessment tables, target planning and a one-click
AcademicBridge marks import. Data lives in PostgreSQL alongside the rest of LMS
Core.

**Admin** — institution-wide directory, statistics and role management.

**SEO** — metadata with Open Graph and Twitter cards, a generated OG image,
`sitemap.xml`, `robots.txt`, a web manifest and `SoftwareApplication` JSON-LD.
Every authenticated route is explicitly `noindex`.

## Project layout

```
prisma/schema.prisma     14 models, 6 enums
prisma/seed.ts           demo classes, students and grades
src/proxy.ts             route gate (Next 16's replacement for middleware.ts)
src/lib/data/*           server-only reads — never network-reachable
src/lib/actions/*        "use server" mutations only
src/lib/auth/guards.ts   requireUser / requireCourseTeacher / requireSubmissionTeacher
src/components/ui/*      shadcn primitives
```

**Reads and writes are deliberately separated.** Every export of a `"use server"`
file is a public POST endpoint, so all reads live in `src/lib/data/*` behind
`import "server-only"` and cannot be called from the network.

## Scripts

| Command | Purpose |
| :-- | :-- |
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:migrate-clabridge` | One-time Firestore → PostgreSQL CLA Bridge import |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run storage:test` | Upload, list and read back an object in the Neon bucket |

## Design system

**One palette.** Everything is a shadcn token from `src/app/globals.css` —
`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`,
`bg-primary`, plus the status tokens `text-success`, `text-warning`,
`text-danger`, `text-info`. There is no second brand palette. Course and avatar
identity uses a *tone ladder* (`slate`, `stone`, `slate-light`, `stone-light`,
`slate-pale`, `stone-pale`) rather than hues, so a class still has its own face
without introducing a colour that competes with the content. The one deliberate
exception is the official Google logo, which keeps Google's brand colours.

**One type scale.** Inter throughout. The font variable sits on `<html>` and
the `font-sans` utility on `<body>`, which is what makes the family resolve —
a custom property is substituted where it is declared, so a variable defined
on the body cannot be picked up by a rule on the root. The same role always
gets the same size:

| Role | Classes |
| :-- | :-- |
| Page heading | `text-2xl font-semibold tracking-tight` |
| Route heading under a persistent course heading | `text-xl font-semibold tracking-tight` |
| Section heading | `text-lg font-semibold tracking-tight` |
| Card heading | `text-base font-semibold leading-tight tracking-tight` |
| Compact subsection | `text-sm font-semibold` |
| Body | `text-sm` |
| Metadata | `text-xs` |

The CLA Bridge estimator is a dense tool, so its sections use the compact
subsection role rather than the section role.

**One heading per page.** The course layout owns the `<h1>`; child routes render
their title as an `<h2>`. Card headings inside them are `<h3>`. `EmptyState`
takes an `as` prop so it can fill the same slot as whatever it replaces.

**The mark.** `src/components/brand/logo.tsx` holds the geometry. The same
drawing is reproduced in `src/app/icon.svg` (favicon) and
`src/app/opengraph-image.tsx` (social card) — keep the three in step. The
wordmark reads its name from `siteConfig`, so it can never drift from the one
used in page titles and metadata.

**Public chrome and prose.** `src/components/marketing/site-header.tsx` and
`site-footer.tsx` are the header and footer that every public page shares — the
landing page and the three policies — so a link is added in one place. Policy
text uses the `.policy-prose` rules in `globals.css`: one measure, one rhythm,
and links and emphasis drawn from the existing tokens instead of a typography
plugin and a second set of defaults.

## Design notes

- **Graceful degradation.** Prisma, Firebase Admin, S3 and Pusher clients are all
  constructed lazily, so `next build` succeeds with a completely empty `.env`.
  Missing services surface as a clear disabled state, never a crash.
- **Authorization at the query.** Guards scope writes by `courseId` in the
  `where` clause rather than checking ownership afterwards, so an id from another
  class simply does not resolve.
- **One session lookup per request.** `getCurrentUser()` is wrapped in
  `React.cache`, so the layout, page, header and every data function share a
  single cookie verification and database read.
- **The landing page is a static document.** It reads no cookies and no
  database, so it is prerendered and served from the CDN.
- **The policies are real pages.** `/privacy`, `/terms` and `/accessibility`
  sit in the same public chrome as the landing page, are listed in the sitemap
  and are linked from the footer. They describe what the code actually does —
  the two cookies and their lifetimes, the storage model, the signed file
  links — and say plainly what has not been done rather than claiming a
  certification. The address they point at comes from
  `NEXT_PUBLIC_CONTACT_EMAIL`; without it they say that no address is
  published instead of showing a placeholder.
- **`proxy.ts` checks cookie presence only.** Real verification happens in server
  components and actions; a forged cookie gets past the gate and dies there.
  A visitor who arrives at the landing page with a cookie is handed to
  `/api/auth/landing`, which verifies it properly: a real session goes to the
  dashboard, a dead one is cleared and the visitor is put back on the landing
  page. Anonymous visitors never reach that route.

## Verified

`prisma validate`, `prisma generate`, `tsc --noEmit`, `eslint`, and
`next build` **with no environment variables at all** — plus a dev-server smoke
test of the public routes, the auth redirect and `/api/health`.

The landing page is prerendered (`○` in the build output) and served as a
static document that never touches the database. Measured on the same machine
against the server-rendered landing page it replaced, it is faster end to end:
first contentful paint 1.1 s (was 1.5 s), total blocking time 0.77 s (was
2.48 s), speed index 2.0 s (was 7.9 s), for about 11 KiB more transferred.
Lighthouse scores 100 for accessibility, best practices and SEO.

The three policy pages are prerendered too, and each scores 100 for
accessibility (checked on `/privacy`, `/terms` and `/accessibility`).

Not verifiable without credentials: migrations against a live database, Firebase
token exchange, presigned uploads (bucket CORS is the usual failure), and Pusher
delivery.
