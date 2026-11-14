# Setup

The app builds and boots with an empty `.env`. Only a **database** is required
before anything useful happens; everything else degrades gracefully.

| Service | Required? | Without it |
| :-- | :-- | :-- |
| PostgreSQL | **Yes** | Pages load, but no data — sign-in fails |
| Firebase Auth | No | `AUTH_DEV_MODE` signs you in without a password |
| Object storage (Neon / R2 / S3) | No | Upload buttons render disabled with a tooltip |
| Pusher | No | Updates arrive on refresh instead of live |

---

## 1. Install

```bash
npm install          # postinstall runs `prisma generate`
cp .env.example .env
```

## 2. Point it at a database

### Option A — Neon (what this project uses)

The production database is the Neon project `neon-amethyst-candle`
(`floral-king-64647468`), running PostgreSQL 18.

1. Sign in with the CLI: `neon login` (or install it first:
   `npm install -g neon@latest`).
2. Copy both connection strings into `.env`:

```bash
# pooled — used by the app at runtime
DATABASE_URL="$(neon connection-string --project-id floral-king-64647468 --pooled)"
# direct — used by Prisma Migrate
DIRECT_URL="$(neon connection-string --project-id floral-king-64647468)"
```

Vercel's Neon integration injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`,
which `prisma.config.ts` already accepts, so no manual wiring is needed there.

Neon locks a project to the major Postgres version it was created with, so
moving to a different major version means creating a new project and copying
the data across — there is no in-place upgrade. The Neon CLI refuses to create
projects inside a Vercel-managed organization; `vercel install neon` does not
have that restriction and provisions a project on the current major version.

### Option B — Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string → URI**.
3. Put the **pooled** connection (port `6543`) in `DATABASE_URL` and the
   **direct** connection (port `5432`) in `DIRECT_URL`:

```ini
DATABASE_URL="postgresql://postgres.abc:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.abc:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

Prisma Migrate needs the direct connection; the app runtime uses the pooled one.

### Option C — Local Postgres via Docker

```bash
docker compose up -d
```

Then in `.env`:

```ini
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/lms_core"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:5432/lms_core"
```

## 3. Create the schema and demo data

```bash
npm run db:migrate    # creates tables (prisma migrate dev)
SEED_ALLOW=true npm run db:seed   # optional: demo classes, students and grades
npm run dev
```

The seed refuses to run without `SEED_ALLOW=true`. It writes fictional users and
classes, and this project's `.env` can point at the live database — so seeding
has to be a deliberate act rather than a side effect of a habit.

If demo data did reach a live database, remove it again:

```bash
npm run db:remove-demo              # dry run: lists what would be deleted
npm run db:remove-demo -- --apply   # deletes the demo classes and users
```

The script refuses to delete a class that a real account has joined.

Open <http://localhost:3000>.

With `AUTH_DEV_MODE=true` (the default in `.env.example`) you can sign in as any
seeded user with **no password**:

| Email | Role | State |
| :-- | :-- | :-- |
| `admin@school.edu` | Teacher + admin | Admin console access |
| `teacher@school.edu` | Teacher | Owns both demo classes |
| `amara@school.edu` | Student | Work graded and returned |
| `ben@school.edu` | Student | Work graded, not yet returned |
| `chidi@school.edu` | Student | Turned in late |
| `dana@school.edu` | Student | Nothing turned in |

---

## Firebase Auth (production sign-in)

`AUTH_DEV_MODE` is ignored when `NODE_ENV=production`, so a real deployment
**must** have Firebase configured.

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method** → enable **Email/Password** and **Google**.
3. **Project settings → General → Your apps → Web app** → copy the config into
   the `NEXT_PUBLIC_FIREBASE_*` variables.
4. **Project settings → Service accounts → Generate new private key**. Paste the
   whole JSON on one line into `FIREBASE_SERVICE_ACCOUNT_KEY`, wrapped in single
   quotes. Base64 is also accepted if your host mangles newlines.
5. **Authentication → Settings → Authorized domains** → add your deployment
   domain, or the Google popup will be rejected.

The first sign-in creates the `User` row. A brand-new account is asked whether
it is a student or a teacher before anything is created, so nobody lands in the
student experience by accident. The role is only honoured on creation — after
that, only an admin can change roles.

## CLA Bridge imports (optional)

CLA Bridge was a standalone app on its own Firebase project. Its students are
pulled into LMS Core so that they keep their nickname, their level and their
marks when they sign up here.

With the credentials in place, nothing has to be run by hand: a student who
signs up with the address they used in the standalone app finds their import
waiting the first time they open `/bridge`.

```ini
# The service account of the standalone project, raw or base64 JSON.
CLABRIDGE_SERVICE_ACCOUNT_KEY="..."
CLABRIDGE_PROJECT_ID="clabridge-d7e6f"
```

On a machine with the service-account file on disk, point at it instead and
keep the key out of the environment:

```ini
CLABRIDGE_SERVICE_ACCOUNT_FILE="C:\path\to\clabridge-service-account.json"
```

To stage everybody at once — and to see who is still waiting — use the admin
console (**Admin console → CLA Bridge imports → Pull new imports**) or the
endpoint a scheduler can call:

```bash
curl -X POST https://<your-deployment>/api/bridge/legacy-sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

Without the credentials the app behaves exactly as it did before the import
existed: no error, no warning, just no imports.

## File uploads (Neon Object Storage, Cloudflare R2 or AWS S3)

Everything speaks the S3 API, so one client covers all three. This project uses
**Neon Object Storage**: the bucket branches with the database, so a preview
branch gets its own copy of the files.

### Neon Object Storage (this project)

```bash
neon config add bucket uploads   # declares the bucket in neon.ts
neon deploy                      # creates it and pulls the credentials
neon env pull                    # writes AWS_* variables into .env
```

`neon deploy` writes the AWS-standard variables the SDKs expect:

```ini
AWS_ACCESS_KEY_ID="..."          # branch credential
AWS_SECRET_ACCESS_KEY="..."
AWS_ENDPOINT_URL_S3="https://br-<branch>.storage.<region>.aws.neon.tech"
AWS_REGION="us-east-1"
S3_BUCKET="uploads"              # optional: defaults to "uploads"
```

The app reads the `S3_*` variables first and falls back to the `AWS_*` ones, so
a deployment can point at R2 or AWS S3 instead without touching the code.

**A deployed app needs these variables in its host's environment** — on Vercel:
Project → Settings → Environment Variables. The access key and secret are
marked as secrets there; the endpoint, region and bucket name are plain. Env
changes only reach new deployments, so redeploy afterwards and confirm with
`GET /api/health`, which reports `services.storage`.

Neon buckets allow cross-origin requests out of the box (all origins, `PUT`,
`GET`, `POST`, `HEAD` and `DELETE`), so the browser can upload straight to the
bucket without any extra configuration.

Check it end to end:

```bash
npm run storage:test   # upload a text file, list the bucket, read it back
```

The test also replays what the browser does — the CORS preflight and a
cross-origin read — and removes the object afterwards, so the bucket is left
empty.

### Cloudflare R2 or AWS S3

```ini
S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
S3_REGION="auto"          # "auto" for R2, e.g. "us-east-1" for AWS
S3_BUCKET="lms-uploads"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
```

Keep the bucket private. Files are served through `/api/files/[id]`, which
checks course membership and redirects to a freshly signed URL; a public bucket
URL would bypass both checks.

**The bucket must allow `PUT` from your app's origin.** The browser uploads
directly, so without CORS every upload fails. Neon sets this up for you;
R2 and AWS S3 need a rule of their own. Example R2 CORS rule:

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Limits live in `src/lib/env.ts`: 25 MB per file and a MIME allowlist.

## Live updates (Pusher)

```ini
PUSHER_APP_ID="..."
PUSHER_SECRET="..."
NEXT_PUBLIC_PUSHER_KEY="..."
NEXT_PUBLIC_PUSHER_CLUSTER="mt1"
```

Channels are private and authorised against enrollment at
`/api/realtime/auth`. Without these keys the app polls every 20 seconds while
the tab is visible — correct, just not instant.

---

## Deploying to Vercel

1. Import the repository.
2. Add every variable from `.env.example` — **omit `AUTH_DEV_MODE`**.
3. Set `NEXT_PUBLIC_SITE_URL` to your production URL so canonical tags, the
   sitemap and social previews resolve correctly.
4. Build command is `npm run build` (which runs `prisma generate` first).
5. Run `npx prisma migrate deploy` against production once, using `DIRECT_URL`.

## Troubleshooting

**`Can't reach database server`** — `DATABASE_URL` is wrong or the database is
asleep. `curl localhost:3000/api/health` reports which services are wired up.

**`prisma migrate` hangs on Supabase** — you are using the pooled port. Migrate
needs `DIRECT_URL` on port 5432.

**Google sign-in popup closes immediately** — the domain is not in Firebase's
authorized domains list.

**Uploads fail with a network error** — bucket CORS. See above.
