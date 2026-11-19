# Deployment: Vercel and Cloudflare Workers

LMS Core deploys from the same source to two targets:

| | Vercel | Cloudflare Workers |
| --- | --- | --- |
| Adapter | none (Next.js native) | `@opennextjs/cloudflare` |
| Build | `npm run build` (Vercel uses `npm run vercel-build`) | `npm run build` wrapped by OpenNext |
| Migrations | `npm run vercel-build` runs `prisma migrate deploy` | run `npm run db:deploy` separately |
| Config | `next.config.ts`, Vercel project env | `wrangler.jsonc`, `open-next.config.ts`, Worker secrets |
| Command | `vercel deploy` / Git integration | `npm run deploy:workers` |

Nothing is Vercel-specific in the app, and nothing is Cloudflare-specific in
`src/`. The only runtime branch is a connection-pool setting in
`src/lib/prisma.ts` (see [Database](#database)).

## Vercel

Unchanged. The project is `class` under `drexal08s-projects`.

- Build command: `npm run vercel-build` (`prisma generate && prisma migrate deploy && next build`)
- `DATABASE_URL` must be the **pooled** Neon connection string.
- Environment changes only reach new deployments: redeploy and check
  `GET /api/health` (`services.storage`, `services.database`).

## Cloudflare Workers

The Worker is built with [OpenNext](https://opennext.js.org/cloudflare), which
wraps the real `next build` output for `workerd`. That keeps App Router, server
actions, Prisma and `firebase-admin` on the same code path as Vercel, instead of
reimplementing the Next.js runtime.

### Prerequisites

- Node.js 20+
- A Cloudflare account
- The Neon `DATABASE_URL` (pooled) and the other runtime variables below

Authenticate once:

```sh
npx wrangler login
# or, in CI:
#   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=...
```

`wrangler.jsonc` deliberately does **not** hardcode an account id. Wrangler uses
the logged-in account, or `CLOUDFLARE_ACCOUNT_ID` when several are available.

### Scripts

```json
"preview:workers": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy:workers":  "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
"upload:workers":  "opennextjs-cloudflare build && opennextjs-cloudflare upload",
"cf-typegen":      "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```

- `preview:workers` runs the whole app in `workerd` locally, including the
  Node compatibility layer. Use it to catch Workers-only failures before
  deploying.
- `deploy:workers` builds and deploys the worker plus static assets.
- `upload:workers` uploads a version without shifting traffic.

Local secrets go in `.dev.vars.local` (gitignored) or the shell. `.dev.vars`
only holds non-secret defaults (`NEXTJS_ENV`, `DEPLOYMENT_TARGET`).

### Building on Windows

OpenNext officially targets Linux and says so at the start of every build. Two
things follow:

- The bundle is produced by copying Next's standalone output, which contains
  directory links. OpenNext recreates them with `symlinkSync`, and Windows only
  allows symlinks with `SeCreateSymbolicLinkPrivilege` (administrator, or
  Developer Mode). Junctions need no privilege and are equivalent here, so
  `patches/@opennextjs+aws+4.0.2.patch` passes `"junction"` on `win32`. It is
  applied by `postinstall` through `patch-package`; without it the build dies
  with `EPERM: operation not permitted, symlink`.
- `wrangler dev` / `preview` must execute `workerd.exe`. On a machine where
  execution of that binary is blocked, the only local alternatives are
  Developer Mode or WSL. When neither is available, build and deploy in CI —
  `.github/workflows/deploy-workers.yml` does exactly that on `ubuntu-latest`.

On Linux the patch is a no-op: `"junction"` is only passed on `win32`.

### CI

`.github/workflows/deploy-workers.yml` runs on `main` pushes (and on demand),
runs the gates, builds with OpenNext and deploys. It needs
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets,
`NEXT_PUBLIC_*` values as repository variables (they are inlined at build time),
and the runtime values as Worker secrets. Migrations run only when the manual
dispatch sets `run_migrations`.

### Environment variables

Set production values as Worker secrets, not in `wrangler.jsonc`:

```sh
npx wrangler secret put DATABASE_URL
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY
npx wrangler secret put PUSHER_APP_ID
npx wrangler secret put PUSHER_SECRET
npx wrangler secret put S3_ACCESS_KEY_ID
npx wrangler secret put S3_SECRET_ACCESS_KEY
```

| Variable | Kind | Notes |
| --- | --- | --- |
| `DATABASE_URL` | secret | Neon **pooled** string; normally `-pooler` host |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | secret | raw JSON or base64; needed for real sign-in |
| `NEXT_PUBLIC_FIREBASE_*` | build-time | inlined by `next build`; set them in the build environment |
| `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | build-time | Pusher is optional |
| `PUSHER_APP_ID`, `PUSHER_SECRET` | secret | Pusher is optional |
| `S3_*` or `AWS_*` | secret | object storage is optional |
| `SCHOOL_TIMEZONE` | plain | defaults to `Africa/Kigali` |
| `AUTH_DEV_MODE` | – | must stay unset in production (hard-disabled there) |

`NEXT_PUBLIC_*` variables are baked into the client bundle at build time, so a
Worker Builds/CI run needs them as build environment variables. Changing one
requires a rebuild, not just a secret update.

### Database

`src/lib/prisma.ts` detects `workerd` (`DEPLOYMENT_TARGET=cloudflare`, set in
`wrangler.jsonc`, or the `Cloudflare-Workers` user agent) and configures the
`pg` pool with `maxUses: 1`. Workers reject reusing a socket across requests;
closing the connection after each query prevents that. On Vercel the same
client keeps its normal pool.

Point `DATABASE_URL` at Neon's **pooled** endpoint. For higher traffic, put
Cloudflare Hyperdrive in front of Neon:

```sh
npx wrangler hyperdrive create lms-core \
  --connection-string="postgresql://...-pooler..."
```

Add the returned id to `wrangler.jsonc`:

```jsonc
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<hyperdrive-id>" }]
```

Then read `HYPERDRIVE.connectionString` instead of `DATABASE_URL` where the
client is created (the commented block in `wrangler.jsonc` marks the place).
Hyperdrive is optional; the Worker already works against the Neon pooler.

### Migrations

The Worker never runs migrations. Apply them from a machine or CI job that can
reach the database:

```sh
DATABASE_URL="<pooled-url>" DIRECT_URL="<direct-url>" npm run db:deploy
```

Do this **before** deploying code that depends on new tables, on both targets.

### Firebase, Pusher and storage

- `firebase-admin` runs under the `nodejs_compat` compatibility flag (set in
  `wrangler.jsonc`). Session cookies are verified on the server, as on Vercel.
  `AUTH_DEV_MODE` must not be set in production.
- Pusher is optional and publishes over HTTPS; without credentials realtime is
  disabled and the app stays correct (every mutation revalidates).
- S3 presigning works with the AWS SDK. The bucket must allow the deployed
  origin (Neon Object Storage allows cross-origin requests by default).

### Static assets

OpenNext copies `public/` and `_next/static` into `.open-next/assets`, served
by Cloudflare's asset layer. `public/_headers` is not required for correctness;
add one if you want long-lived immutable caching for `/_next/static/*`.

## Verifying a deployment

1. `GET /api/health` — database and optional services.
2. Sign in with a real Firebase account (not dev mode).
3. Open a course, enter a mark, mark a register, open `/reports/<termId>`.
4. Upload a small file and open the returned presigned URL.

## Known differences

- **No middleware.** The app has no `proxy.ts`. Next 16 runs proxies on the
  Node.js runtime only, and every OpenNext release refuses to build Node
  middleware (`useNodeMiddleware` in the adapter), so keeping one would have
  ruled out the Workers target. The session gate lives in
  `src/app/(app)/layout.tsx` instead, and the signed-in `/` shortcut is a
  cookie-conditioned rewrite in `next.config.ts`. Both targets therefore behave
  identically, except that the redirect to `/login` no longer carries a
  `?next=` parameter.
- **Image optimization**: the app does not use `next/image`, so no Cloudflare
  Images binding is configured.
- **Caching**: every authenticated route is `force-dynamic`; no R2 incremental
  cache is configured. Add one in `open-next.config.ts` if ISR/SSG is
  introduced.
- **Bundle size**: Workers have a compressed size limit (3 MB free / 10 MB
  paid). `firebase-admin`, the AWS SDK and Prisma all inflate the server
  bundle; if a deploy fails on size, check the plan before splitting routes.
- **Local dev**: `npm run dev` stays on Node. Use `npm run preview:workers` to
  test the workerd path.
