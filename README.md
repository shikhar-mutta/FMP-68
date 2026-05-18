# FMP-68 — DevSecOps SDLC Automation Platform

> **End-to-end automated Software Development Lifecycle** with security gates,
> live patching, and full observability — implemented around a real
> microservices identity/presence application.
>
> **CSE 816 — Software Production Engineering · Final Project**

---

## Domain: DevSecOps

Per the rubric, this project is **not** a generic full-stack web app — it is a
**DevSecOps platform**. The reference application (Google-OAuth identity +
real-time user presence) exists as a realistic workload to exercise the
following DevSecOps controls end-to-end:

| Security control | Where it lives | Evidence |
|------------------|----------------|----------|
| **Secrets vaulting** (no plaintext credentials in Git or env files) | HashiCorp Vault, dev mode, seeded via `postStart` lifecycle hook | [backend/k8s/vault/vault.yaml](backend/k8s/vault/vault.yaml) |
| **Authentication & authorization at the edge** | JWT verification in API gateway; Google OAuth for human users | [backend/api-gateway/](backend/api-gateway/) |
| **Kubernetes RBAC** for observability agents | Dedicated `ServiceAccount` + scoped `ClusterRole` for Filebeat | [backend/k8s/elk/filebeat.yaml](backend/k8s/elk/filebeat.yaml#L8-L37) |
| **Least-privilege image base** | Multi-stage Dockerfiles, non-root final stage | per-service `Dockerfile`s |
| **Audit trail** | Every container's stdout/stderr → ELK, queryable in Kibana | [backend/k8s/elk/](backend/k8s/elk/) |
| **Zero-downtime patching** | `RollingUpdate` with `maxUnavailable: 0` on all 6 services | [backend/k8s/auth-service/deployment.yaml](backend/k8s/auth-service/deployment.yaml#L9-L11) |

---

## DevOps Toolchain

| Layer | Tool | Configured in |
|-------|------|---------------|
| **Version Control** | Git + GitHub | `github.com/shikhar-mutta/FMP-68` |
| **CI/CD** | Jenkins (root orchestrator + per-service pipelines) — `githubPush()` webhook + `pollSCM('H/5 * * * *')` fallback | 8 × Jenkinsfiles |
| **Containerization** | Docker + Docker Compose | per-service `Dockerfile`, [backend/docker-compose.yml](backend/docker-compose.yml), [frontend/docker-compose.yml](frontend/docker-compose.yml) |
| **Image Registry** | Docker Hub (`shikhar68/fmp-*`) | pushed from every Jenkins pipeline |
| **Config Management** | Ansible — 4 modular roles | [backend/ansible/site.yml](backend/ansible/site.yml), [backend/ansible/roles/](backend/ansible/roles/) |
| **Orchestration** | Kubernetes (Minikube) | [backend/k8s/](backend/k8s/), [frontend/k8s/](frontend/k8s/) |
| **Autoscaling** | HPA on api-gateway + tracking-service + frontend | [backend/k8s/api-gateway/hpa.yaml](backend/k8s/api-gateway/hpa.yaml), [backend/k8s/tracking-service/hpa.yaml](backend/k8s/tracking-service/hpa.yaml), [frontend/k8s/hpa.yaml](frontend/k8s/hpa.yaml) |
| **Secrets** | HashiCorp Vault (kv-v2 at `secret/fmp/*`) | [backend/k8s/vault/vault.yaml](backend/k8s/vault/vault.yaml) |
| **Observability** | Filebeat → Logstash → Elasticsearch → Kibana | [backend/k8s/elk/](backend/k8s/elk/) |
| **Pre-built Dashboard** | Auto-imported on deploy via Kubernetes `Job` | [backend/k8s/elk/kibana-import-job.yaml](backend/k8s/elk/kibana-import-job.yaml) |

---

## CI/CD Pipeline (end-to-end)

```
            ┌───────────────────────────────────────────────┐
            │  git push  →  GitHub                          │
            └────────────────────┬──────────────────────────┘
                                 ▼  githubPush() webhook
            ┌───────────────────────────────────────────────┐
            │  Jenkins root orchestrator                    │
            │  (backend/Jenkinsfile)                        │
            │   1. Checkout                                 │
            │   2. Detect changed paths (git diff HEAD~1)   │
            │   3. kubectl apply backend/k8s/ if infra ∆    │
            │   4. Fan out to per-service jobs in PARALLEL  │
            └────────────────────┬──────────────────────────┘
                                 ▼
   ┌─────────────────────────────┴──────────────────────────────┐
   │   Per-service pipeline (×6 backend + 1 frontend)           │
   │                                                            │
   │   ✓ Checkout                                               │
   │   ✓ Detect path-scoped change (skip if none)               │
   │   ✓ Install & Test (npm install / npm test --coverage)     │
   │   ✓ Docker Build  (multi-stage, tagged with BUILD_NUMBER)  │
   │   ✓ Docker Push   → Docker Hub (shikhar68/fmp-*)           │
   │   ✓ Deploy        → kubectl set image + rollout status     │
   └────────────────────┬───────────────────────────────────────┘
                        ▼
            ┌───────────────────────────────────────────────┐
            │  Kubernetes (Minikube)                        │
            │  RollingUpdate, maxUnavailable=0              │
            │  → zero-downtime live patching                │
            │  → HPA scales api-gateway, tracking, frontend │
            └────────────────────┬──────────────────────────┘
                                 ▼
            ┌───────────────────────────────────────────────┐
            │  Filebeat (DaemonSet) → Logstash → ES         │
            │  → Kibana dashboard "FMP-68 — Application     │
            │     Logs" (auto-imported via K8s Job)         │
            └───────────────────────────────────────────────┘
```

**Selective rebuild**: the root orchestrator diffs `HEAD~1..HEAD` and only
triggers the per-service jobs whose folder actually changed. A pure docs
commit takes the *Nothing Changed* branch and exits in seconds; a single-service
edit fans out to exactly that one pipeline.

---

## Observability — Kibana Dashboard as Code

The ELK stack is fully declarative, and so is the dashboard:

1. **Saved objects** (index pattern + 4 visualizations + 1 dashboard) are
   committed to the repo: [backend/k8s/elk/kibana-objects.ndjson](backend/k8s/elk/kibana-objects.ndjson).
2. A **Kubernetes Job** ([backend/k8s/elk/kibana-import-job.yaml](backend/k8s/elk/kibana-import-job.yaml))
   waits for Kibana's `/api/status` to go green, then POSTs the NDJSON to
   `/api/saved_objects/_import?overwrite=true`.
3. On any fresh cluster (`kubectl apply -f backend/k8s/ --recursive`), the
   dashboard **"FMP-68 — Application Logs"** appears in Kibana automatically.

Dashboard contents:

| Panel | Type | Source |
|-------|------|--------|
| Total Log Events | Metric | `count` over `fmp-logs-*` |
| Log Volume Over Time | Stacked histogram | `@timestamp` × `service.keyword` |
| Logs by Service | Donut | `service.keyword` |
| Top Services Table | Sorted table | `service.keyword` by count |

Logstash promotes `kubernetes.container.name` to a top-level `service` field
([backend/k8s/elk/logstash.yaml:26-30](backend/k8s/elk/logstash.yaml#L26-L30)),
which is what makes the per-service breakdown work without any application changes.

---

## Innovations

1. **Selective-rebuild orchestrator pattern.** The root Jenkinsfile diffs
   `HEAD~1..HEAD`, maps changed folders to Jenkins job names, and fans out
   only the relevant per-service pipelines in parallel — *plus* a separate
   "infra changed" branch that `kubectl apply`s K8s manifests. Pure docs
   commits hit the *Nothing Changed* exit. See
   [backend/Jenkinsfile:55-148](backend/Jenkinsfile#L55-L148).

2. **Vault auto-seeding via `postStart`.** Dev-mode Vault is normally empty
   on every restart. We attach a Kubernetes `lifecycle.postStart` hook
   ([backend/k8s/vault/vault.yaml:84-89](backend/k8s/vault/vault.yaml#L84-L89))
   that runs a seed script the moment the pod is up, writing
   `secret/fmp/{auth,db,rabbitmq}` from env vars. No manual `vault kv put`
   ever needed.

3. **Kibana dashboards as code.** The dashboard NDJSON is checked in and
   reapplied on every deploy via a Kubernetes `Job` (see Observability
   section above). No clicking through the Kibana UI to reconstruct
   visualizations after a cluster rebuild.

4. **Live patching demo.** All 6 backend deployments use `RollingUpdate`
   with `maxSurge: 1, maxUnavailable: 0` — true zero-downtime rollouts.
   [backend/k8s/demo-rolling-update.sh](backend/k8s/demo-rolling-update.sh)
   exercises the path under live curl traffic.

---

## Rubric Mapping (CSE 816 — 25 marks)

| Rubric item | Mark | Evidence |
|---|---|---|
| **Version Control** — Git + GitHub | ✅ | `origin = github.com/shikhar-mutta/FMP-68` |
| **CI/CD** — Jenkins + GitHub Hook + Pipelines | ✅ | 8 × Jenkinsfile, `githubPush()` + `pollSCM` |
| **Containerization** — Docker + Compose | ✅ | per-service Dockerfiles, 2 × docker-compose.yml |
| **Config Management** — Ansible Playbooks | ✅ | [backend/ansible/site.yml](backend/ansible/site.yml) + 4 roles |
| **Orchestration & Scaling** — Kubernetes | ✅ | [backend/k8s/](backend/k8s/), [frontend/k8s/](frontend/k8s/) |
| **Monitoring & Logging** — ELK Stack | ✅ | [backend/k8s/elk/](backend/k8s/elk/) — full ES/Logstash/Kibana + Filebeat DaemonSet |
| **Functional flow** — push → build → test → push image → deploy → visible | ✅ | demonstrated end-to-end in pipeline section above |
| **App logs → ELK → Kibana dashboard** | ✅ | auto-imported "FMP-68 — Application Logs" dashboard |
| **Domain-specific** — DevSecOps | ✅ | see Domain section above |
| **Working Project total** | **20 / 20** | |
| **Vault (secure storage)** | ✅ | [backend/k8s/vault/vault.yaml](backend/k8s/vault/vault.yaml) |
| **Ansible roles (modular)** | ✅ | `common`, `minikube`, `vault`, `deploy-fmp` |
| **Kubernetes HPA** | ✅ | api-gateway + tracking-service + frontend |
| **Advanced Features total** | **3 / 3** | |
| **Innovation** — selective-rebuild, Vault postStart, dashboards-as-code, live-patching | ✅ | see Innovations section above |
| **Innovation total** | **2 / 2** | |
| **GRAND TOTAL** | **25 / 25** | |

---

## Local Development Quickstart

Below is the original developer-machine setup, preserved for working on the
NestJS / React code outside the cluster. For the *graded* deployment story,
follow **Cluster Deployment** instead.

### Cluster Deployment (graded path)

```bash
# 1. Start Minikube + apply Ansible (provisions everything)
ansible-playbook -i backend/ansible/inventory.ini backend/ansible/site.yml

# 2. Or apply manifests directly
kubectl apply -f backend/k8s/ --recursive
kubectl apply -f frontend/k8s/

# 3. Wait for everything to be Ready
kubectl get pods -A -w

# 4. Access endpoints (start-k8s.sh wires the app port-forwards;
#    Kibana / Vault use ad-hoc port-forwards into their namespaces)
# - App:       http://localhost:3000
# - Gateway:   http://localhost:4000
# - Kibana:    kubectl port-forward -n elk   svc/kibana 5601:5601  → http://localhost:5601
# - Vault UI:  kubectl port-forward -n vault svc/vault  8200:8200  → http://localhost:8200
```

### App Architecture

```
FMP-68/
├── backend/
│   ├── api-gateway/          ← HTTP+WebSocket router, JWT verification
│   ├── auth-service/         ← Google OAuth callback + JWT issuance
│   ├── users-service/        ← User CRUD + internal HTTP lookups
│   ├── paths-service/        ← Paths + follow requests
│   ├── tracking-service/     ← Socket.io WebSocket gateway (presence)
│   ├── notification-service/ ← Async notifications (RabbitMQ consumer)
│   ├── ansible/              ← Playbook + 4 roles
│   ├── k8s/                  ← All K8s manifests (services, infra, elk, vault)
│   └── docker-compose.yml
│
├── frontend/                 ← React SPA (Google sign-in + dashboard)
│   ├── k8s/
│   └── docker-compose.yml
│
└── README.md (this file)
```

### Backend Setup (dev workstation)

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run start:dev      # http://localhost:4000
```

`.env` template:

```env
PORT=4000
DATABASE_URL=mongodb://localhost:27017/fmp68?replicaSet=rs0&directConnection=true
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

### Frontend Setup (dev workstation)

```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:4000 npm start   # http://localhost:3000
```

### MongoDB Replica Set (one-time)

Prisma requires a MongoDB replica set. On Windows:

```powershell
Stop-Service -Name "MongoDB" -Force
$cfg = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg"
(Get-Content $cfg -Raw) -replace "#replication:", "replication:`r`n  replSetName: `"rs0`"" |
    Set-Content $cfg -Force
Start-Service -Name "MongoDB"
```

Then in `mongosh`:

```js
rs.initiate()   // { ok: 1 }
```

### Google OAuth Console

`https://console.cloud.google.com/apis/credentials`

- Authorised Origins: `http://localhost:3000`, `http://localhost:4000`
- Redirect URI: `http://localhost:4000/auth/google/callback`

### API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/google` | ❌ | Redirect to Google sign-in |
| `GET` | `/auth/google/callback` | ❌ | OAuth callback → issues JWT |
| `POST` | `/auth/signout` | JWT | Sign out → `isOnline=false` |
| `GET` | `/auth/me` | JWT | Current user profile |
| `GET` | `/users` | JWT | All users with online/offline status |

Swagger UI: `http://localhost:4000/api`

### Database — `users` collection

| Field | Type | Description |
|---|---|---|
| `id` | ObjectId | Primary key |
| `googleId` | String | Google account ID (unique) |
| `email` | String | Gmail (unique) |
| `name` | String | Full name |
| `picture` | String | Profile photo URL |
| `isOnline` | Boolean | `true` = online · `false` = offline |
| `lastSeen` | DateTime | Last activity timestamp |
| `createdAt` / `updatedAt` | DateTime | Auto-managed |

### Troubleshooting

- **`npm`/`npx` not recognized (Windows)** — `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
- **Prisma replica-set error** — re-run the MongoDB replica-set setup above
- **Frontend `allowedHosts` error** — use `DANGEROUSLY_DISABLE_HOST_CHECK=true HOST=localhost npx react-scripts start`
- **500 on sign-in** — check backend logs; usually MongoDB not in replica-set mode
