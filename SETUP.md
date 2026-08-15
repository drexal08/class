# Setup

The app builds and boots with an empty `.env`. Only a **database** is required
before anything useful happens; everything else degrades gracefully.

| Service | Required? | Without it |
| :-- | :-- | :-- |
| PostgreSQL | **Yes** | Pages load, but no data — sign-in fails |
| Firebase Auth | No | `AUTH_DEV_MODE` signs you in without a password |
| Cloudflare R2 / S3 | No | Upload buttons render disabled with a tooltip |
| Pusher | No | Updates arrive on refresh instead of live |

---

## 1. Install

```bash
npm install          # postinstall runs `prisma generate`
cp .env.example .env
```

## 2. Point it at a database

### Option A — Supabase (recommended, free)

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string → URI**.
3. Put the **pooled** connection (port `6543`) in `DATABASE_URL` and the
   **direct** connection (port `5432`) in `DIRECT_URL`:

```ini
DATABASE_URL="postgresql://postgres.abc:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.abc:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

Prisma Migrate needs the direct connection; the app runtime uses the pooled one.

### Option B — Local Postgres via Docker

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
npm run db:seed       # optional: demo classes, students and grades
npm run dev
```

Open <http://localhost:3000>.

With `AUTH_DEV_MODE=true` (the default in `.env.example`) you can sign in as any
seeded user with **no password**:

| Email | Role | State |
| :-- | :-- | :-- |
| `admin@school.edu` | Admin | Admin console access |
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

The first sign-in creates the `User` row. The role chosen at sign-up is only
honoured on creation — after that, only an admin can change roles.

## File uploads (Cloudflare R2 or AWS S3)

R2 speaks the S3 API, so one set of variables covers both.

```ini
S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
S3_REGION="auto"          # "auto" for R2, e.g. "us-east-1" for AWS
S3_BUCKET="lms-uploads"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_URL="https://files.yourdomain.com"   # optional public domain
```

**The bucket must allow `PUT` from your app's origin.** The browser uploads
directly, so without CORS every upload fails. Example R2 CORS rule:

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
