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
#   CLOUDFLARE_API_TOKEN=...
```

`wrangler.jsonc` pins `name` (`class`) and `account_id` (the `core` account,
workers.dev subdomain `2core`), the same way `clabridge`'s does. The Worker is
served at `https://class.2core.workers.dev`. Pinning the account means a deploy
cannot land in the wrong account when several are logged in; the name must match
the Worker that already exists, because Wrangler deploys to it by name.

The config deliberately has **no** `services` / `WORKER_SELF_REFERENCE`
binding. OpenNext only uses that binding for its Durable Object queue (cache
revalidation), which this app does not configure, and pointing it at a Worker
name that does not exist fails the whole deploy with
`references Worker 'x' which was not found`.

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

OpenNext officially targets Linux and says so at the start of every build. Three
things follow:

- The bundle is produced by copying Next's standalone output, which contains
  directory links. OpenNext recreates them with `symlinkSync`, and Windows only
  allows symlinks with `SeCreateSymbolicLinkPrivilege` (administrator, or
  Developer Mode). Junctions need no privilege and are equivalent here, so
  `patches/@opennextjs+aws+4.0.2.patch` passes `"junction"` on `win32`. It is
  applied by `postinstall` through `patch-package`; without it the build dies
  with `EPERM: operation not permitted, symlink`.
- OpenNext rewrites Turbopack's wasm loader into a switch of literal
  `import()` paths, and it used to paste the absolute path into the generated
  source unescaped. On Windows that produced `C:\Users\...` with `\n`, `\U`
  and friends turning into control characters, so `wrangler` could not resolve
  `resvg.wasm` and `yoga.wasm` (used by `src/app/opengraph-image.tsx`).
  `patches/@opennextjs+cloudflare+1.20.1.patch` emits the paths with
  `JSON.stringify` and builds the switch keys with forward slashes. On Linux
  the generated code is byte-for-byte what it was, so this changes nothing
  there.
- `wrangler dev` / `preview` must execute `workerd.exe`. On a machine where
  execution of that binary is blocked, the only local alternatives are
  Developer Mode or WSL. When neither is available, let the Cloudflare build
  (which runs on Linux) produce the bundle — see below.

Both patches are no-ops on Linux.

### Deploying

Deploys come from the Cloudflare build connected to this repository, not from a
GitHub Action: a push builds on Cloudflare's Linux builders and uploads the
Worker `class`. There is deliberately no `.github/workflows` deploy job, because
a second deployer would race the first and could finish last with an older
build.

Because the build runs on Cloudflare's side, `NEXT_PUBLIC_*` values must be set
in the Worker's build configuration (they are inlined at build time), the
runtime values as Worker secrets, and migrations must be applied separately
(`npm run db:deploy`) — the build never touches the schema.

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
npx wrangler hyperdrive create class \
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
- **Bundle size**: the built Worker is ~24 MiB raw / **~5.1 MiB gzip**, because
  Prisma, `pg`, `firebase-admin`, the AWS SDK and the `next/og` wasm binaries
  all ship in the server bundle. The Free plan caps a Worker at 3 MiB gzip, so
  **deploying this app needs a paid Workers plan** (10 MB). Re-measure with
  `npx wrangler deploy --dry-run` after big dependency changes.
- **Local dev**: `npm run dev` stays on Node. Use `npm run preview:workers` to
  test the workerd path.
