# Harshit Education Center

Public website and secure learning-material platform for an educational institute.
The public site is a React SPA; the material library behind it is authenticated and
role-aware, with separate student, teacher and admin workspaces.

## Stack

| Layer | Technology |
| --- | --- |
| Client | React 18, Vite 6, TypeScript, Tailwind CSS, React Router, TanStack Query |
| Server | Node 20+, Express 4, TypeScript, Mongoose (MongoDB), Zod, JWT, Multer |
| Storage | Local disk by default, S3-compatible via `STORAGE_PROVIDER=s3` |
| Tests | Node's built-in test runner driven over real HTTP (`node --test` + `tsx`) |

The repository is an npm workspace with two packages: `client/` and `server/`.

## Getting started

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run seed          # optional: demo content and the three demo accounts
npm run dev           # server on :5000, client on :5173
```

The client dev server proxies `/api` to `http://localhost:5000`, so both halves work
from the same origin in development with no CORS setup.

### Seeded accounts

`npm run seed` creates one account per role. Change these before any real deployment.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@harshiteducationcenter.in` | `Admin@12345` |
| Teacher | `teacher@harshiteducationcenter.in` | `Teacher@12345` |
| Student | `student@harshiteducationcenter.in` | `Student@12345` |

The seed is destructive: it clears the collections it owns before inserting.

### Recovering a Railway administrator

If the demo admin account is missing or its password is unknown, recover or
create an admin without reseeding or deleting any application data. Deploy the
updated app, then run `node server/dist/recover-admin.js` in a trusted
environment configured with the Railway service's `MONGODB_URI`. Provide
`ADMIN_EMAIL` and a new `ADMIN_PASSWORD` (8-128 characters); optionally provide
`ADMIN_NAME` to set the account name. Do not use the seed credentials for a
production account.

The command only creates the specified account or resets the password and
reactivates that account if it is already an admin. It refuses to promote an
existing student or teacher account. Remove the recovery variables from the
environment after the command succeeds, and never paste production database
credentials or passwords into chat or source control.

## Scripts

| Command | Effect |
| --- | --- |
| `npm run dev` | Runs the API and the Vite dev server together |
| `npm run build` | Builds the client bundle, then compiles the server |
| `npm run typecheck` | Type-checks both workspaces |
| `npm test` | Runs the end-to-end API suite |
| `npm run seed` | Resets and repopulates the database |
| `npm run admin:recover` | Creates or recovers one admin account without clearing data; requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` |
| `npm start` | Runs the compiled server from `server/dist` |

## Configuration

Server settings are read from `server/.env` and validated by Zod at boot, so a bad
value fails fast instead of surfacing later at runtime.

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/harshit_education` | Connection string |
| `JWT_SECRET` | development-only value | Must be ≥ 32 chars; the server refuses to boot in production with the default |
| `CLIENT_URL` | `http://localhost:5173` | CORS allow-list; accepts a comma-separated list |
| `STORAGE_PROVIDER` | `local` | `local` or `s3` |
| `STORAGE_BUCKET` / `STORAGE_REGION` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` / `STORAGE_ENDPOINT` | empty | Required for `s3`; `STORAGE_ENDPOINT` also enables path-style addressing for MinIO and similar |

The client reads `VITE_API_URL` (default `/api`).

## API overview

| Prefix | Access | Purpose |
| --- | --- | --- |
| `/api/health` | public | Liveness probe |
| `/api/public/*` | public, optional auth | Settings, classes, boards, subjects, courses, notices, gallery, testimonials, teachers, material catalogue, enquiries |
| `/api/auth/*` | mixed | Login, current user, profile update, password change; public registration is disabled |
| `/api/materials/*` | signed in | Favourites, purchases, download history, file download |
| `/api/dashboard/*` | student / teacher / admin | Role-scoped summaries; teachers and admins manage materials |
| `/api/admin/*` | admin | Users, teacher accounts and approvals, notices, settings, enquiries, purchases, overview |
| `/api/files/:key` | signed in | Streams a stored file |

Only administrators can create student and teacher accounts. In `/dashboard/admin`,
use the **Students** tab to create student logins and the **Teachers** tab to
create staff logins or review teacher approvals. Admin-created staff accounts
are approved immediately. Public account registration is disabled in both the
client and API. Existing pending teacher profiles cannot sign in until an admin
approves them, and revoking approval blocks both new logins and existing
sessions. Teachers can only manage materials they uploaded unless an admin
grants the `canManageAllMaterials` flag on their profile.

To open the admin panel, sign in with an administrator account and choose
**Dashboard**; the admin dashboard is available at `/dashboard/admin`. The
seeded admin account is for local/demo setup only. Change its password and
remove or disable seeded demo accounts before exposing a deployment.

## Deployment

The API and the built client are served from a **single origin** by one Node
process, so there is no second web server to configure and no CORS to get wrong in
production.

### Docker (recommended)

```bash
export JWT_SECRET="$(openssl rand -base64 48)"   # required; compose refuses to start without it
docker compose up -d --build
```

This brings up MongoDB plus the app, waits for the database to be healthy, and
exposes the site on http://localhost:5000. Seed demo content if you want it:

```bash
docker compose exec app node server/dist/seed.js
```

The image is a two-stage build: the first compiles the client and server, the
second carries only production dependencies and the compiled output, running as
the unprivileged `node` user. It runs `node` as PID 1 in exec form so the
graceful shutdown handler receives `SIGTERM` directly.

### Without Docker

```bash
npm ci
npm run build
NODE_ENV=production JWT_SECRET=... npm start
```

This requires Node 20+ and a reachable MongoDB.

### Railway (free tier)

Railway runs the `Dockerfile` as a long-lived container, which is the closest
match to how the app is built to run: one Node process serving both the API and
the client, with a writable disk for uploads and no request-size cap.

The free tier costs $0 and includes 0.5 GB of RAM, a 0.5 GB volume and a
subdomain. It is the only free host checked that provides persistent storage,
which is what keeps `STORAGE_PROVIDER=local` viable.

1. Push the repository to GitHub.
2. In Railway, choose **New Project → Deploy from GitHub repo**. The `Dockerfile`
   at the root is detected automatically; `railway.json` pins the builder, the
   health check, the restart policy and the build watch patterns.

   `railway.json` **overrides** whatever the dashboard shows — Railway resolves
   settings as environment config → config in code → dashboard settings. So
   even if **Settings** says the builder is Railpack, the committed
   `"builder": "DOCKERFILE"` wins. One thing to check in the dashboard is the
   **root directory**: it must be empty (or `/`), because a `server` root would
   build only the backend and the client would 404.
3. Attach a **volume** mounted at `/app/server/uploads`. Without it, uploaded
   material is lost on every redeploy.
4. Set the variables below.
5. Seed the database from a machine that has the credentials:

```bash
MONGODB_URI="<atlas-uri>" JWT_SECRET=... STORAGE_PROVIDER=local npm run seed
```

Environment variables:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | **MongoDB Atlas** connection string. Railway has no database of its own; the free M0 tier (512 MB) is enough to start |
| `JWT_SECRET` | At least 32 characters. Production refuses to boot on the placeholder |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | The Railway domain, e.g. `https://hec.up.railway.app` |
| `TRUST_PROXY` | `1`. Railway proxies the app, and rate limiting keys off the client IP |
| `STORAGE_PROVIDER` | `local`, backed by the volume |
| `UPLOAD_MAX_MB` | `15` is fine. Unlike Vercel there is no platform request-size cap |

> **No `RAILWAY_RUN_UID` needed.** Railway mounts volumes owned by root, which
> normally makes uploads fail with `EACCES` for an image that runs as a
> non-root user — Railway's own workaround is to set `RAILWAY_RUN_UID=0` and
> run the whole app as root. This image instead uses `docker/entrypoint.sh`: it
> starts as root, `chown`s the upload directory to `node`, then drops privileges
> with `su-exec` before exec'ing the server. The fix is in the image, so there
> is nothing extra to configure, and the app still never runs as root. The same
> entrypoint makes the `docker-compose` stack work unchanged.

Two limits worth planning around: the volume holds 0.5 GB, which a few hundred
PDFs will fill, and the free tier has a single instance with no autoscaling. When
the volume fills, switch to Cloudflare R2 (10 GB free, S3-compatible) by setting
`STORAGE_PROVIDER=s3` with `STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com`;
no code change is needed.

Because a volume service is single-replica, Railway briefly takes a service
offline while it redeploys. The `SIGTERM` handler in `server.ts` drains
in-flight requests first, so a deploy does not cut a live download short.

### Vercel

Vercel runs the app as a serverless function plus a static client, wired up by
`vercel.json` and the `api/index.ts` entry point.

> **Vercel's Hobby plan is restricted to non-commercial, personal use.** Running a
> paid tuition site on it breaches the fair-use guidelines and risks the account
> being suspended. Use the Pro plan, or prefer the Railway setup above.

```bash
npm i -g vercel
vercel link
vercel env add JWT_SECRET production      # generate with: openssl rand -base64 48
vercel env add MONGODB_URI production     # your Atlas connection string
vercel --prod
```

The client is uploaded from `client/dist` and served by the CDN; `/api/*` is
rewritten to the function, which re-exports `server/src/vercel.ts`. Because the
two halves are served from the same origin, `CLIENT_URL` still needs to list the
production domain for CORS, and `VITE_API_URL` can stay at its `/api` default.

Required environment variables:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | **MongoDB Atlas** connection string. Vercel has no database of its own and no way to run one, so a hosted cluster is required |
| `JWT_SECRET` | At least 32 characters. Production refuses to boot on the placeholder |
| `CLIENT_URL` | The production domain, e.g. `https://your-app.vercel.app` |
| `TRUST_PROXY` | `1`. Vercel is the single hop in front of the app, and rate limiting keys off the client IP |
| `STORAGE_PROVIDER` | `s3` — see the note below |
| `STORAGE_BUCKET` / `STORAGE_REGION` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | Your S3-compatible bucket credentials |
| `UPLOAD_MAX_MB` | `4`. Vercel rejects request bodies over 4.5 MB before the app is reached |
| `MONGODB_MAX_POOL_SIZE` | `5` is fine; keep it low because every function instance holds its own pool |

Two platform constraints shape that configuration and are worth understanding
before deploying:

- **The filesystem is read-only and ephemeral.** Uploaded files cannot live on
  the function's disk, so `STORAGE_PROVIDER` must be `s3`. The upload middleware
  falls back to the system temp directory for request scratch space, and the
  storage adapter moves the file into the bucket from there.
- **The 4.5 MB request cap.** Vercel returns `413 FUNCTION_PAYLOAD_TOO_LARGE`
  for larger bodies before the app runs at all. `UPLOAD_MAX_MB` is therefore set
  below that so users get a clear message from the app instead of an opaque
  platform error. Serving larger material needs a direct-to-S3 upload path
  (presigned URL), which this codebase does not implement.

`npm run seed` cannot run on Vercel for the same reason, so seed the Atlas
database from a machine that has the credentials:

```bash
MONGODB_URI="<atlas-uri>" JWT_SECRET=... STORAGE_PROVIDER=s3 ... npm run seed
```

### Required production configuration

| Variable | Notes |
| --- | --- |
| `JWT_SECRET` | **Mandatory.** Must be at least 32 characters. The server refuses to boot in production if it is still either the schema default or the placeholder from `.env.example` |
| `MONGODB_URI` | Point at your managed or self-hosted MongoDB |
| `CLIENT_URL` | The public origin, used for the CORS allow-list |
| `TRUST_PROXY` | `0` when nothing proxies the app, `1` behind a single nginx/ALB hop. **Get this right** — rate limiting and HTTPS detection both key off the client IP, so a wrong value either rate-limits every visitor as one client or lets a caller spoof `X-Forwarded-For` to evade the limiter |
| `STORAGE_PROVIDER` | `s3` for object storage, `local` otherwise. With `local`, mount `server/uploads` on a persistent volume or uploaded material is lost on every redeploy |

### Operational behaviour

- **Graceful shutdown.** `SIGTERM` stops new connections, drains in-flight
  requests, closes MongoDB and exits. A forced-exit timer guarantees the process
  cannot hang if a request refuses to finish.
- **Health probe.** `GET /api/health` returns `200 {"status":"ok"}`. The Dockerfile
  polls it, so an unhealthy container is restarted rather than left serving errors.
- **Caching.** Hashed assets are served `immutable, max-age=1y`; `index.html` is
  `no-cache`, so a deploy is picked up on the next load without stale bundles.
- **Rate limiting.** 500 requests per 15 minutes per client IP on `/api`.
- **Static assets** are served by the API process itself, so there is nothing to
  mount separately.

### Continuous integration

`.github/workflows/ci.yml` runs typecheck, build, the end-to-end suite (against a
throwaway MongoDB) and a `docker build` on every push and pull request to `main`.

## Tests

`npm test` boots the real Express app on an ephemeral port and drives it over HTTP,
so middleware, routers, models and the local storage adapter are all exercised as
they run in production. The suite uses its own throwaway database
(`harshit_education_e2e`) and drops it afterwards, so it never touches seeded data.
A MongoDB instance must be reachable on `127.0.0.1:27017`.

## Storage

Uploads are written to `server/uploads/` and git-ignored. Multer streams a file to
disk before the handler validates the payload, so failed requests clean up their
temporary files in the error handler and a failed database write rolls back the
files already stored. When deploying with `STORAGE_PROVIDER=s3`, the same
`storage` adapter interface handles the move to object storage.
