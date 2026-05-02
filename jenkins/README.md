# FMP-68 — Jenkins Setup Guide

## Overview
9 separate Jenkins jobs — one per microservice + one for infrastructure.
Each job is **isolated**: changing `auth-service` only triggers `fmp68-auth-service`, not any other job.

---

## Prerequisites
Install these Jenkins plugins:
- **Git** (built-in)
- **Pipeline** (built-in)
- **GitHub Integration** — for webhook triggers
- **Email Extension (Email-ext)** — for email notifications
- **Docker Pipeline** — for Docker commands in pipeline

---

## Step 1 — Configure Credentials

In Jenkins → **Manage Jenkins → Credentials → System → Global**:

| ID | Type | Description |
|---|---|---|
| `docker-hub-credentials` | Username/Password | Docker Hub login (shikhar68 / your-token) |
| `github-credentials` | Username/Password (or SSH) | GitHub access for SCM polling |

---

## Step 2 — Configure Email

In Jenkins → **Manage Jenkins → System → Email Notification**:
- SMTP server: `smtp.gmail.com`
- Port: `587`, Use TLS: ✅
- User: `shikharmutta67@gmail.com`
- Password: Gmail App Password

---

## Step 3 — Create Jobs (repeat for each service)

1. Jenkins → **New Item** → Enter name → Select **Pipeline** → OK
2. Under **General**: check **"GitHub project"**, enter repo URL
3. Under **Build Triggers**: check **"GitHub hook trigger for GITScm polling"** ✅
4. Under **Pipeline**:
   - Definition: **Pipeline script from SCM**
   - SCM: **Git**
   - Repository URL: `https://github.com/shikhar-mutta/FMP-68.git`
   - Branch: `*/main`
   - Script Path: (see table below)
5. Click **Save**

### Job Names & Script Paths

| Job Name | Script Path |
|---|---|
| `fmp68-auth-service` | `jenkins/Jenkinsfile.auth-service` |
| `fmp68-user-service` | `jenkins/Jenkinsfile.user-service` |
| `fmp68-paths-service` | `jenkins/Jenkinsfile.paths-service` |
| `fmp68-follow-service` | `jenkins/Jenkinsfile.follow-service` |
| `fmp68-tracking-service` | `jenkins/Jenkinsfile.tracking-service` |
| `fmp68-api-gateway` | `jenkins/Jenkinsfile.api-gateway` |
| `fmp68-frontend` | `jenkins/Jenkinsfile.frontend` |
| `fmp68-infra` | `jenkins/Jenkinsfile.infra` |

---

## Step 4 — GitHub Webhook

In GitHub repo → **Settings → Webhooks → Add webhook**:
- Payload URL: `http://<your-jenkins-ip>:8080/github-webhook/`
- Content type: `application/json`
- Events: **Just the push event** ✅

---

## How Isolation Works

Each Jenkinsfile has a **"Detect Changes"** stage:
```groovy
def changed = sh(script: "git diff --name-only HEAD~1 HEAD", returnStdout: true)
if (!changed.contains('services/auth-service')) {
    currentBuild.result = 'NOT_BUILT'  // skip — no relevant changes
}
```
- Push to `services/auth-service/` → only `fmp68-auth-service` builds
- Push to `services/user-service/` → only `fmp68-user-service` builds
- Git failure in one job → **zero impact on other jobs**

---

## Pipeline Stages (each microservice)

```
Checkout → Detect Changes → Install → Test → Docker Build → Docker Push → Deploy (Ansible)
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Docker build fails | Check `docker info` — Jenkins user must be in `docker` group |
| Ansible not found | `which ansible` — install with `pip install ansible` |
| Email not sent | Check SMTP config and Gmail App Password |
| HPA not working | Install metrics-server: `bash k8s/deploy.sh` does this automatically |
