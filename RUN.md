# FMP-68 — Run instructions

Three ways to bring the stack up. All of them do a **clean rebuild**
(no cached image layers, fresh containers, fresh volumes).

| Command | What it starts |
|---------|----------------|
| `./start.sh` | Backend + frontend together (local dev) |
| `./backend/start.sh` | Backend only (6 microservices + RabbitMQ + Redis) |
| `./frontend/start.sh` | Frontend only (nginx serving the React SPA) — backend must already be up |
| `./start-online.sh` | **Online mode** — same stack reachable from the public internet via ngrok (production-style nginx build) |
| `./start-online-watch.sh` | **Online + watch mode** — same as above but the frontend runs the CRA dev server, so code edits hot-reload to every remote viewer |

`./start.sh --stop` tears the local-dev stack down.
`./stop-online.sh` tears the online stack down (handles both prod and watch).

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

The React code calls the api-gateway on `http://localhost:4000` —
exposed by `docker-compose` directly, or by the `kubectl port-forward`
that `start-k8s.sh` wires up when running on Kubernetes. No ingress
or `/etc/hosts` entries needed.

---

## Stop everything

```bash
./start.sh --stop
```

Removes all `fmp-*` containers, images, volumes built by these
compose files, plus the `fmp-net` network. Doesn't touch Jenkins
or any Kubernetes resources you may also have running.

---

## Option D — Online mode (expose the laptop publicly via ngrok)

Run the same stack on your laptop but make it reachable from any
device on the public internet at a stable HTTPS URL. Free, requires
no domain, OAuth keeps working. Two flavours:

| Script | Frontend | When to use |
|--------|----------|-------------|
| `./start-online.sh` | Production-style nginx serving the built React bundle | Sharing a demo when you don't expect to change code |
| `./start-online-watch.sh` | CRA dev server (`npm start`) inside a container with HMR | Active development — every edit hot-reloads on every remote viewer (laptops, phones) |

### One-time setup

1. **ngrok account + stable dev domain** (free tier).
   - Sign up at <https://ngrok.com>, copy your authtoken from the dashboard.
   - Reserve a free static domain (Domains tab → defaults to a `*.ngrok-free.dev` subdomain).
   - On the host:
     ```bash
     sudo snap install ngrok
     ngrok config add-authtoken <YOUR_AUTHTOKEN>
     ```

2. **Tell the scripts which domain to use.** Edit two files and
   replace the example domain with yours:
   - `backend/.env.online` → `ONLINE_PUBLIC_URL` and `ONLINE_GOOGLE_CALLBACK_URL`
   - `frontend/.env.online` → `ONLINE_PUBLIC_URL` and `ONLINE_REACT_APP_API_URL`
   - `start-online.sh` / `start-online-watch.sh` → the `NGROK_DOMAIN` variable at the top

3. **Update Google OAuth credentials** (in Google Cloud Console → your OAuth client). Add **in addition to** the existing localhost entries:
   - Authorized JavaScript origin: `https://<your-domain>.ngrok-free.dev`
   - Authorized redirect URI: `https://<your-domain>.ngrok-free.dev/auth/google/callback`
   - Save and wait ~5 min for propagation.

### Running it

```bash
./start-online.sh            # production-style
# or
./start-online-watch.sh      # watch / HMR
```

To run the watch script in **detached mode** (keeps running after terminal closes):

```bash
nohup bash start-online-watch.sh > watch.log 2>&1 &
```

- `nohup` — immune to terminal hangup
- `> watch.log 2>&1` — stdout + stderr go to `watch.log`
- `&` — sends to background; note the PID printed (or run `echo $!` right after)

Stop it with `kill <PID>` or `./stop-online.sh`.

What each script does:

1. Pre-flight (Docker, ngrok install + authtoken).
2. Tears down any prior online containers.
3. Recreates `fmp-net` from scratch (so its Docker Compose labels are clean).
4. Brings up the **backend** with `docker-compose.yml + docker-compose.online.yml` overrides — only `FRONTEND_URL` / `GOOGLE_CALLBACK_URL` differ from local dev; the actual NestJS code is unchanged.
5. Brings up the **frontend**:
   - **Prod-style**: rebuilds the React bundle with `REACT_APP_API_URL` pointing at the public URL, swaps in `frontend/nginx.online.conf` (which serves the SPA *and* reverse-proxies `/auth /users /paths /follow-requests /socket.io` to `api-gateway:4000`).
   - **Watch**: runs `react-scripts start` in a `node:20-alpine` container with `src/` bind-mounted; CRA's setupProxy handles the backend routes. HMR WebSocket is forced to `wss://` via a sed-patch on `webpack-dev-server`'s config (CRA 5 has no env var for that).
6. Starts `ngrok http --domain=<your-domain> 3000` in the foreground.

When you see the green `✅ Online stack is up.` banner followed by the ngrok ASCII dashboard, open `https://<your-domain>.ngrok-free.dev` from any device. First-time visitors click "Visit Site" once on ngrok's interstitial — that's the only friction.

### Single-tunnel architecture

ngrok's free tier gives **one** stable domain, so both the SPA and the backend live behind the same hostname:

```
Phone / laptop / friend's device
       │ HTTPS
       ▼
<your-domain>.ngrok-free.dev:443
       │
       ▼ ngrok tunnel
host port 3000 → frontend container
       │
       ├─ /                       → React SPA (HTML/JS/CSS)
       ├─ /auth /users /paths …   → proxied to api-gateway:4000
       └─ /socket.io              → proxied to api-gateway:4000 (WebSocket upgrade)
                                            │
                                            └─ tracking-service:4004
```

### Stop

```bash
./stop-online.sh
```

Tears down both the prod-style and watch-mode stacks, kills any
running `ngrok http` process. Doesn't touch local-dev containers
spawned by `./start.sh`.

### Online-mode files

All parallel to existing files — local dev is never modified:

| File | Purpose |
|------|---------|
| `backend/.env.online` | Online URL values (`ONLINE_PUBLIC_URL`, `ONLINE_GOOGLE_CALLBACK_URL`) |
| `backend/docker-compose.online.yml` | Overrides `FRONTEND_URL`/`GOOGLE_CALLBACK_URL` on api-gateway, auth-service, tracking-service |
| `frontend/.env.online` | `REACT_APP_API_URL` set to the public URL |
| `frontend/nginx.online.conf` | nginx SPA + reverse-proxy config (prod-style only) |
| `frontend/setupProxy.online.js` | CRA dev-server proxy → api-gateway (watch-mode only) |
| `frontend/docker-compose.online.yml` | Prod-style overrides (build arg + nginx mount) |
| `frontend/docker-compose.online-watch.yml` | Watch-mode (Node container, bind-mounted src, HMR config) |
| `start-online.sh` / `start-online-watch.sh` | Orchestrators |
| `stop-online.sh` | Teardown for both online flavours |

### Caveats

- **ngrok free-tier interstitial** — first browser visit shows a "Visit Site" page. One click and it's done for that session. The OAuth callback that follows reuses the same browser session, so it doesn't re-trigger.
- **Laptop sleep / Wi-Fi drop** — if the host falls offline, remote viewers lose access until it comes back.
- **Backend hot-reload** — `start-online-watch.sh` only watches `frontend/src/`. NestJS code still requires a rebuild + container restart.

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
├── start.sh                          ← root orchestrator (option A)
├── start-online.sh                   ← option D: online prod-style + ngrok
├── start-online-watch.sh             ← option D: online watch (HMR) + ngrok
├── stop-online.sh                    ← teardown for both online flavours
├── run_test.sh                       ← root test runner (backend + frontend coverage)
├── RUN.md                            ← you are here
├── backend/
│   ├── start.sh                      ← option B
│   ├── run_test.sh                   ← jest --coverage across all 6 services
│   ├── docker-compose.yml            ← 6 services + RabbitMQ + Redis
│   ├── docker-compose.online.yml     ← online-mode env overrides
│   ├── .env.online                   ← online URL values
│   └── …
└── frontend/
    ├── start.sh                      ← option C
    ├── run_test.sh                   ← react-scripts test --coverage
    ├── docker-compose.yml            ← joins the existing fmp-net network
    ├── docker-compose.online.yml     ← prod-style online overrides (nginx)
    ├── docker-compose.online-watch.yml ← watch-mode online (CRA dev server)
    ├── nginx.online.conf             ← SPA + reverse-proxy nginx config
    ├── setupProxy.online.js          ← CRA dev-server proxy (watch mode)
    ├── .env.online                   ← online URL values
    └── …
```
