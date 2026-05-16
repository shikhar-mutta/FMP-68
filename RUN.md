# FMP-68 — Run instructions

Three ways to bring the stack up. All of them do a **clean rebuild**
(no cached image layers, fresh containers, fresh volumes).

| Command | What it starts |
|---------|----------------|
| `./start.sh` | Backend + frontend together |
| `./backend/start.sh` | Backend only (6 microservices + RabbitMQ + Redis) |
| `./frontend/start.sh` | Frontend only (nginx serving the React SPA) — backend must already be up |

`./start.sh --stop` tears everything down.

---

## Pre-requisites on the host

- **Docker** + **docker compose v2**
- **MongoDB** running locally with replica set `rs0` initialised and
  `bindIp: 0.0.0.0` (or include the docker0 bridge in `bindIp`) — the
  backend containers reach it via `host.docker.internal`.

Quick check:
```bash
mongosh --quiet --eval "rs.status().ok"   # should print 1
docker info                                # should not error
```

---

## Option A — both together (recommended)

```bash
./start.sh
```

What this does:
1. Pre-flight (docker, mongod)
2. **Backend stack**: `docker compose down --rmi local --volumes` →
   `docker compose build --no-cache` → `up -d` → waits for `/health`
   on every microservice.
3. **Frontend stack**: verifies `fmp-net` network exists →
   `docker compose down --rmi local` → `docker compose build --no-cache` →
   `up -d` → waits for `http://localhost:3000/` to return 200.

When it finishes you'll see:

```
http://localhost:3000    Frontend
http://localhost:4000    Backend gateway
http://localhost:15672   RabbitMQ UI  (guest / guest)
```

---

## Option B — backend only

```bash
./backend/start.sh
```

Brings up the 6 microservices + RabbitMQ + Redis on the `fmp-net`
network. After it finishes:

| URL | Service |
|-----|---------|
| `http://localhost:4000/health` | api-gateway |
| `http://localhost:4001/health` | auth-service |
| `http://localhost:4002/health` | users-service |
| `http://localhost:4003/health` | paths-service |
| `http://localhost:4004/health` | tracking-service |
| `http://localhost:4005/health` | notification-service |
| `http://localhost:15672` | RabbitMQ management UI (guest/guest) |
| `http://localhost:6379` | Redis |

---

## Option C — frontend only

```bash
./frontend/start.sh
```

**Requires the backend to already be up** (the script checks for the
`fmp-net` Docker network and exits with a clear error if it's missing).

Builds the nginx image from scratch and runs it on host port 3000.
After it finishes:

| URL | Notes |
|-----|-------|
| `http://localhost:3000/` | SPA shell |

The React code calls `http://fmp.local/auth/...` etc. — to test the
full flow with the cluster, add `127.0.0.1 fmp.local` (or
`<minikube ip> fmp.local`) to `/etc/hosts`. For pure docker-compose
testing without K8s, the frontend code still works against the
backend on `localhost:4000` because the bundled URL is configurable.

---

## Stop everything

```bash
./start.sh --stop
```

Removes all `fmp-*` containers, images, volumes built by these
compose files, plus the `fmp-net` network. Doesn't touch Jenkins
or any Kubernetes resources you may also have running.

---

## Running tests with coverage

Three scripts mirror the `start.sh` layout — one per side, plus a
root orchestrator. Each prints the Jest coverage table to the
terminal and writes an HTML report under `coverage/lcov-report/`.

| Command | What it runs |
|---------|--------------|
| `./run_test.sh` | Backend (all 6 services) + frontend, with combined summary |
| `./run_test.sh backend` | Backend only |
| `./run_test.sh frontend` | Frontend only |
| `./backend/run_test.sh` | All 6 microservices, per-service summary |
| `./backend/run_test.sh auth-service` | One specific microservice |
| `./frontend/run_test.sh` | Frontend React + Jest coverage |

### What each script does

- **Frontend** — runs `react-scripts test --coverage --watchAll=false`
  with `CI=true` so Jest exits after one run and prints the coverage
  summary table (`% Stmts / % Branch / % Funcs / % Lines`).
- **Backend** — iterates over `api-gateway`, `auth-service`,
  `users-service`, `paths-service`, `tracking-service`,
  `notification-service`. For each: runs `npm ci` if `node_modules`
  is missing, runs `prisma generate` if a `schema.prisma` exists,
  then `jest --coverage`. Exits non-zero if any service fails.
- **Root** — invokes the backend and frontend scripts in sequence
  and prints a combined PASS / FAIL table. Useful for CI.

### Where the reports land

After a successful run:

```
backend/<service>/src/coverage/lcov-report/index.html   # one per service
frontend/coverage/lcov-report/index.html                # frontend SPA
```

Open any of these in a browser for the colour-coded line-by-line
coverage view.

### Coverage scope

Backend (`jest.config` in each service's `package.json`):
- includes all `*.ts` files under `src/`
- excludes `main.ts`, `*.module.ts`, `strategies/`, `guards/`,
  `health/`, and `*.spec.ts`

Frontend (`jest` block in `frontend/package.json`):
- includes all `src/**/*.{js,jsx}`
- excludes `index.js`, `reportWebVitals.js`, `setupTests.js`,
  any `__tests__/`, `__mocks__/`, and `*.test.*` / `*.spec.*` files

### Requirements

- Node 18+ and npm available on the host (the test scripts run
  outside Docker, directly against the source tree).
- No running backend stack is required — tests use mocks and an
  in-process Jest environment.

---

## What "clean rebuild" actually means

Every `start.sh` invocation:

1. Runs `docker compose down --rmi local --volumes --remove-orphans`
2. Deletes any leftover `fmp-*:local` images that compose missed
3. Prunes the build cache layers used by previous builds
4. Runs `docker compose build --no-cache` so every `RUN` step
   re-executes (npm install, prisma generate, nest build, …)
5. Brings the containers up fresh

This guarantees:
- No stale node_modules from a previous build
- No cached layers hiding a broken dependency change
- No old volumes preserving inconsistent state across reboots

The downside is build time — expect ~3–5 min for the first clean
rebuild on a fresh machine, ~90 s thereafter (Docker layer cache
above the `--no-cache` flag still helps for base images).

---

## File layout

```
FMP-68/
├── start.sh                        ← root orchestrator (this file's option A)
├── run_test.sh                     ← root test runner (backend + frontend coverage)
├── RUN.md                          ← you are here
├── backend/
│   ├── start.sh                    ← option B
│   ├── run_test.sh                 ← jest --coverage across all 6 services
│   ├── docker-compose.yml          ← 6 services + RabbitMQ + Redis
│   └── …
└── frontend/
    ├── start.sh                    ← option C
    ├── run_test.sh                 ← react-scripts test --coverage
    ├── docker-compose.yml          ← joins the existing fmp-net network
    └── …
```
