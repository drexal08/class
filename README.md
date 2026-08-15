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
| Database | PostgreSQL (Supabase) via Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| Storage | Cloudflare R2 / AWS S3 via presigned `PUT` |
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

**Admin** — institution-wide directory, statistics and role management.

**SEO** — metadata with Open Graph and Twitter cards, a generated OG image,
`sitemap.xml`, `robots.txt`, a web manifest and `SoftwareApplication` JSON-LD.
Every authenticated route is explicitly `noindex`.

## Project layout

```
prisma/schema.prisma     11 models, 5 enums
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
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Prisma Studio |

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
- **`proxy.ts` checks cookie presence only.** Real verification happens in server
  components and actions; a forged cookie gets past the gate and dies there.

## Verified

`prisma validate`, `prisma generate`, `tsc --noEmit`, `eslint`, and
`next build` **with no environment variables at all** — plus a dev-server smoke
test of the public routes, the auth redirect and `/api/health`.

Not verifiable without credentials: migrations against a live database, Firebase
token exchange, presigned uploads (bucket CORS is the usual failure), and Pusher
delivery.
