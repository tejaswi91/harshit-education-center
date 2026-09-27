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

## Scripts

| Command | Effect |
| --- | --- |
| `npm run dev` | Runs the API and the Vite dev server together |
| `npm run build` | Builds the client bundle, then compiles the server |
| `npm run typecheck` | Type-checks both workspaces |
| `npm test` | Runs the end-to-end API suite |
| `npm run seed` | Resets and repopulates the database |
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
| `/api/auth/*` | mixed | Register, login, current user, profile update, password change |
| `/api/materials/*` | signed in | Favourites, purchases, download history, file download |
| `/api/dashboard/*` | student / teacher / admin | Role-scoped summaries; teachers and admins manage materials |
| `/api/admin/*` | admin | Users, teacher approvals, notices, settings, enquiries, purchases, overview |
| `/api/files/:key` | signed in | Streams a stored file |

Teachers can only manage materials they uploaded unless an admin grants the
`canManageAllMaterials` flag on their profile. Newly registered teachers stay
pending until an admin approves them, and a pending teacher cannot upload.

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
