# DevOps Implementation Guide

## Overview
This document provides a comprehensive guide for implementing a complete DevOps framework to automate the Software Development Life Cycle (SDLC). The implementation follows industry best practices and aligns with the SPE course requirements.

---

## Phase 1: Containerization (Docker & Docker Compose)

### Objective
Containerize both backend (NestJS) and frontend (React) applications along with supporting services like PostgreSQL database.

### Files to Create

#### 1. Backend Dockerfile
**Location:** `backend/Dockerfile`
```dockerfile
# Backend Dockerfile structure
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Build NestJS app
COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

#### 2. Frontend Dockerfile
**Location:** `frontend/Dockerfile`
```dockerfile
# Frontend Dockerfile structure
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 3. Frontend nginx.conf
**Location:** `frontend/nginx.conf`
```nginx
server {
  listen 80;
  location / {
    root /usr/share/nginx/html;
    index index.html index.htm;
    try_files $uri $uri/ /index.html;
  }
}
```

#### 4. Docker Compose Configuration
**Location:** `docker-compose.yml`

Contains orchestration for:
- **Backend Service** (NestJS on port 3000)
- **Frontend Service** (React/Nginx on port 3001)
- **PostgreSQL Database** (port 5432)
- **pgAdmin** (Database UI on port 5050)
- **Volumes** for persistent data
- **Networks** for inter-service communication
- **Environment variables** for configuration

**Key Services:**
```yaml
services:
  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
  
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://...
  
  frontend:
    build: ./frontend
    ports:
      - "3001:80"
    depends_on:
      - backend
```

#### 5. .dockerignore Files
**Locations:** `backend/.dockerignore` and `frontend/.dockerignore`

Exclude unnecessary files from Docker builds:
- node_modules
- npm-debug.log
- .git
- .gitignore
- README.md
- coverage
- dist
- build

### Commands to Execute
```bash
# Build containers
docker-compose build

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## Phase 2: CI/CD Automation (Jenkins)

### Objective
Implement automated CI/CD pipeline with Jenkins to fetch code, build, test, push to Docker Hub, and deploy.

### Files to Create

#### 1. Jenkinsfile
**Location:** `Jenkinsfile` (root directory)

Pipeline stages:
1. **Checkout** - Clone from GitHub
2. **Build** - Build Docker images
3. **Test** - Run Jest test suites
4. **Push** - Push images to Docker Hub
5. **Deploy** - Deploy to target system
6. **Cleanup** - Remove old images

**Pipeline Structure:**
```groovy
pipeline {
    agent any
    
    environment {
        DOCKER_HUB_CREDENTIALS = credentials('docker-hub-credentials')
        REGISTRY = 'dockerhub-username'
        BACKEND_IMAGE = "${REGISTRY}/app-backend:${BUILD_NUMBER}"
        FRONTEND_IMAGE = "${REGISTRY}/app-frontend:${BUILD_NUMBER}"
    }
    
    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/shikhar-mutta/FMP-68.git'
            }
        }
        
        stage('Build') {
            steps {
                script {
                    sh 'docker-compose build'
                }
            }
        }
        
        stage('Test') {
            steps {
                script {
                    sh 'docker-compose run --rm backend npm run test:cov'
                    sh 'docker-compose run --rm frontend npm run test'
                }
            }
        }
        
        stage('Push to Registry') {
            steps {
                script {
                    sh 'docker login -u $DOCKER_HUB_CREDENTIALS_USR -p $DOCKER_HUB_CREDENTIALS_PSW'
                    sh 'docker tag backend:latest ${BACKEND_IMAGE}'
                    sh 'docker tag frontend:latest ${FRONTEND_IMAGE}'
                    sh 'docker push ${BACKEND_IMAGE}'
                    sh 'docker push ${FRONTEND_IMAGE}'
                }
            }
        }
        
        stage('Deploy') {
            steps {
                script {
                    sh 'ansible-playbook ansible/playbooks/deploy.yml -i ansible/inventory/hosts.ini'
                }
            }
        }
        
        stage('Cleanup') {
            steps {
                sh 'docker system prune -f'
            }
        }
    }
    
    post {
        always {
            junit 'backend/coverage/test-results.xml'
            publishHTML([
                reportDir: 'backend/coverage/lcov-report',
                reportFiles: 'index.html',
                reportName: 'Backend Coverage Report'
            ])
        }
        failure {
            echo 'Pipeline failed! Notifications sent.'
        }
    }
}
```

#### 2. GitHub Repository Configuration

**Settings to Configure:**
- GitHub Webhook URL: `https://jenkins-server/github-webhook/`
- Event Types: Push events, Pull requests
- Trigger Jenkins on push to main branch

#### 3. Jenkins Configuration as Code (JCasC)
**Location:** `jenkins/jenkins.yaml`

Automates Jenkins setup with:
- Security configuration
- Credentials management
- Plugin installation
- Job creation

### Credentials to Add in Jenkins
- Docker Hub credentials
- GitHub credentials
- SSH keys for deployment servers
- Database credentials

---

## Phase 3: Configuration Management (Ansible)

### Objective
Use Ansible playbooks for infrastructure provisioning, configuration, and deployment with modular role-based design.

### Directory Structure
```
ansible/
├── roles/
│   ├── docker-role/
│   │   ├── tasks/
│   │   │   └── main.yml
│   │   ├── handlers/
│   │   │   └── main.yml
│   │   └── templates/
│   │       └── docker-compose.j2
│   ├── app-role/
│   │   ├── tasks/
│   │   │   └── main.yml
│   │   └── templates/
│   │       └── .env.j2
│   └── monitoring-role/
│       ├── tasks/
│       │   └── main.yml
│       └── templates/
│           └── elk-config.j2
├── playbooks/
│   ├── deploy.yml
│   ├── configure-server.yml
│   └── monitoring.yml
├── inventory/
│   ├── hosts.ini
│   └── group_vars/
│       └── all.yml
└── ansible.cfg
```

### Key Playbooks

#### 1. Deploy Playbook
**Location:** `ansible/playbooks/deploy.yml`

Tasks:
- Pull latest code from GitHub
- Stop running containers
- Build new Docker images
- Start containers with docker-compose
- Verify service health
- Run database migrations

#### 2. Configure Server Playbook
**Location:** `ansible/playbooks/configure-server.yml`

Tasks:
- Install Docker & Docker Compose
- Install Docker Python SDK
- Configure firewall rules
- Create application directories
- Setup SSL/TLS certificates

#### 3. Monitoring Playbook
**Location:** `ansible/playbooks/monitoring.yml`

Tasks:
- Deploy ELK Stack components
- Configure log shipping
- Setup Kubernetes monitoring
- Install Prometheus & Grafana

### Variable Management
**Location:** `ansible/inventory/group_vars/all.yml`

Store configuration variables:
- Docker registry URLs
- Database credentials
- API endpoints
- Resource limits
- Environment-specific settings

### Best Practices Implemented
- Modular role-based design
- Idempotent operations
- Error handling with handlers
- Vault integration for secrets
- Comprehensive logging

---

## Phase 4: Orchestration & Scaling (Kubernetes)

### Objective
Deploy application to Kubernetes cluster with automatic scaling, self-healing, and load balancing capabilities.

### Directory Structure
```
k8s/
├── namespace.yaml
├── configmap.yaml
├── secrets.yaml
├── postgres/
│   ├── pvc.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── backend/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── hpa.yaml
├── frontend/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
├── ingress.yaml
└── network-policy.yaml
```

### Key Manifests

#### 1. Namespace
**Location:** `k8s/namespace.yaml`

Provides resource isolation:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: app-namespace
```

#### 2. ConfigMaps & Secrets
**Locations:** `k8s/configmap.yaml`, `k8s/secrets.yaml`

ConfigMaps store:
- Application configuration
- API endpoints
- Feature flags

Secrets store:
- Database passwords
- API keys
- JWT secrets
- Docker registry credentials

#### 3. Database Deployment
**Location:** `k8s/postgres/deployment.yaml`

PostgreSQL setup with:
- StatefulSet for data persistence
- PersistentVolume for storage
- Service for database access
- Environment-specific configurations

#### 4. Backend Deployment
**Location:** `k8s/backend/deployment.yaml`

Features:
- Replicas for high availability
- Resource limits and requests
- Liveness and readiness probes
- Environment variable injection
- Mount secrets as volumes

#### 5. Frontend Deployment
**Location:** `k8s/frontend/deployment.yaml`

Features:
- Nginx-based deployment
- Static file serving
- SPA routing configuration
- Health checks

#### 6. Horizontal Pod Autoscaler (HPA)
**Location:** `k8s/backend/hpa.yaml` and `k8s/frontend/hpa.yaml`

Auto-scaling configuration:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 85
```

#### 7. Service Configuration
**Locations:** `k8s/backend/service.yaml`, `k8s/frontend/service.yaml`

Services for:
- Internal communication (ClusterIP)
- External access (LoadBalancer/NodePort)
- DNS resolution
- Load distribution

#### 8. Ingress Configuration
**Location:** `k8s/ingress.yaml`

Features:
- HTTPS termination
- Routing to backend/frontend
- SSL certificates management
- Path-based routing

#### 9. Network Policies
**Location:** `k8s/network-policy.yaml`

Security rules for:
- Pod-to-pod communication
- Ingress/egress restrictions
- Namespace isolation
- External traffic control

### Deployment Commands
```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get deployments -n app-namespace

# Monitor HPA
kubectl get hpa -n app-namespace -w

# View pod logs
kubectl logs -f <pod-name> -n app-namespace

# Get service endpoints
kubectl get services -n app-namespace
```

---

## Phase 5: Monitoring & Logging (ELK Stack)

### Objective
Implement comprehensive logging and monitoring using Elasticsearch, Logstash, and Kibana stack.

### Architecture Components

#### 1. Elasticsearch
**Purpose:** Centralized log storage and search engine
- Stores all application and system logs
- Enables full-text search
- Provides time-series analysis
- Handles log indexing and retention policies

**Configuration:**
- Multi-node cluster for high availability
- Index lifecycle management
- Retention policies (30 days default)
- Backup and recovery setup

#### 2. Logstash
**Purpose:** Log processing and transformation pipeline
- Collects logs from multiple sources
- Parses and enriches log data
- Filters sensitive information
- Routes logs to Elasticsearch

**Log Sources:**
- Backend application logs (via JSON format)
- Frontend error logs
- Docker container logs
- System/kernel logs
- Nginx access logs

**Processing Pipeline:**
```
Input (Application) → Filter (Parse/Enrich) → Output (Elasticsearch)
```

#### 3. Kibana
**Purpose:** Visualization and analysis dashboard
- Interactive dashboards for system monitoring
- Real-time log analysis
- Data exploration
- Alert configuration

**Dashboards to Create:**
- Application performance metrics
- Error rate trends
- User activity monitoring
- System resource utilization
- API response times

### Backend Integration

#### NestJS Logger Configuration

Integrate Winston or Pino logger:
```typescript
// Backend sends structured JSON logs
logger.info('Event occurred', {
  timestamp: new Date(),
  userId: req.user.id,
  action: 'follow_request_created',
  statusCode: 201,
  responseTime: 45
});
```

Log these to:
- File system (rotated daily)
- Logstash via HTTP/syslog
- Elasticsearch directly (if configured)

### Frontend Integration

#### React Error Logging

Send frontend errors to backend:
```javascript
// Frontend captures errors and sends to backend logging endpoint
fetch('/api/logs', {
  method: 'POST',
  body: JSON.stringify({
    level: 'error',
    message: error.message,
    stack: error.stack,
    userAgent: navigator.userAgent,
    url: window.location.href
  })
});
```

### Docker Compose Configuration

ELK services:
```yaml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.x
  environment:
    - discovery.type=single-node
  ports:
    - "9200:9200"
  volumes:
    - elasticsearch_data:/usr/share/elasticsearch/data

logstash:
  image: docker.elastic.co/logstash/logstash:8.x
  volumes:
    - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
  ports:
    - "5000:5000"
  depends_on:
    - elasticsearch

kibana:
  image: docker.elastic.co/kibana/kibana:8.x
  ports:
    - "5601:5601"
  depends_on:
    - elasticsearch
```

### Logstash Configuration

**Location:** `logstash/logstash.conf`

Input from:
- Application logs via HTTP
- Container logs via Docker plugin
- Nginx logs

Filter:
- Parse JSON structures
- Extract metadata (userId, requestId)
- Mask sensitive data (passwords, tokens)
- Timestamp normalization

Output:
- Send to Elasticsearch with proper indexing
- Index naming: `logs-app-YYYY.MM.DD`

### Kibana Dashboard Queries

Query formats:
- Filter by log level (ERROR, WARN, INFO)
- Search by userId or requestId
- Time-range analysis
- Exception/error tracking
- API performance metrics

---

## Phase 6: Security - HashiCorp Vault Integration

### Objective
Implement secure credential management using HashiCorp Vault for storing and rotating secrets.

### Vault Setup

#### 1. Vault Server Configuration
**Location:** `vault/config.hcl`

Features:
- Enable authentication methods (JWT, AppRole)
- Configure secret engines (KV v2)
- Setup audit logging
- Enable TLS encryption

#### 2. Secrets Management

**Secret Paths to Create:**
- `secret/app/database` - DB credentials
- `secret/app/api-keys` - Third-party API keys
- `secret/app/jwt` - JWT signing keys
- `secret/app/docker-hub` - Docker registry credentials

#### 3. Ansible Integration

Ansible playbook to:
- Authenticate with Vault
- Retrieve secrets dynamically
- Inject secrets into containers
- Rotate credentials periodically

**Ansible Vault Task:**
```yaml
- name: Retrieve database credentials from Vault
  hashi_vault:
    url: "{{ vault_addr }}"
    auth_method: jwt
    jwt: "{{ jwt_token }}"
    path: secret/app/database
  register: db_credentials
```

#### 4. Application Integration

Backend (NestJS):
- Connect to Vault at startup
- Load secrets into environment
- Implement secret rotation
- Handle Vault unsealing on restart

Frontend (React):
- Retrieve secrets via backend API
- Never store secrets directly in frontend
- Use encrypted localStorage if needed

#### 5. Kubernetes Integration

Vault Agent Injector:
- Automatically inject secrets into pods
- Sync secrets with environment variables
- Handle secret rotation without pod restart

**Pod Annotation Example:**
```yaml
vault.hashicorp.com/agent-inject: "true"
vault.hashicorp.com/role: "app-role"
vault.hashicorp.com/agent-inject-secret-database: "secret/data/app/database"
```

### Key Features Implemented

- **Encryption at Rest:** All secrets encrypted in Vault
- **Audit Logging:** All secret access logged
- **Dynamic Secrets:** Auto-rotation of credentials
- **High Availability:** Vault cluster setup
- **Disaster Recovery:** Backup and restore procedures

---

## Phase 7: Deployment & Validation

### Pre-Deployment Checklist

#### 1. Local Testing
```bash
# Test Docker Compose locally
docker-compose up
docker-compose exec backend npm run test:cov
docker-compose exec frontend npm run test

# Verify all services are running
docker ps
curl http://localhost:3000/api/health
curl http://localhost:3001
```

#### 2. Kubernetes Validation
```bash
# Validate manifest syntax
kubectl apply -f k8s/ --dry-run=client

# Deploy to staging cluster
kubectl apply -f k8s/ -n staging

# Monitor rollout status
kubectl rollout status deployment/backend -n staging
```

#### 3. Integration Testing
- End-to-end API tests
- Frontend functionality tests
- Database connectivity tests
- Authentication flow tests

### Deployment Process

#### 1. Production Deployment Steps
1. Tag releases in Git with semantic versioning (v1.0.0)
2. Jenkins triggers on tag push
3. Build and test in pipeline
4. Push images to Docker Hub with tag
5. Deploy to Kubernetes production cluster
6. Run smoke tests
7. Monitor ELK dashboard for errors
8. Verify health checks passing

#### 2. Rollback Procedure
```bash
# In case of issues, rollback to previous version
kubectl rollout undo deployment/backend -n app-namespace
kubectl rollout undo deployment/frontend -n app-namespace

# Verify services recovered
kubectl get pods -n app-namespace
```

### Post-Deployment Validation

#### 1. Service Health Checks
```bash
# Check all services are running
kubectl get pods -n app-namespace

# Verify HPA metrics
kubectl get hpa -n app-namespace

# Check service endpoints
kubectl get endpoints -n app-namespace
```

#### 2. Application Testing
- Login functionality
- Follow request creation
- Live tracking
- Path sharing
- API response times

#### 3. Monitoring Dashboard Verification
- Kibana dashboard loads
- Logs are being indexed
- No application errors
- Performance metrics within thresholds

### Operational Runbooks

#### Daily Operations
- Monitor ELK Stack dashboards
- Check Kubernetes pod health
- Review error logs
- Verify backup completion

#### During Issues
1. Check logs in Kibana
2. Inspect pod events: `kubectl describe pod <pod-name>`
3. Check resource usage
4. Verify network connectivity
5. Review audit logs in Vault

---

## Quick Reference Commands

### Docker
```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f        # View logs
docker ps                     # List running containers
docker exec -it <container> bash  # Access container shell
```

### Kubernetes
```bash
kubectl apply -f k8s/         # Deploy manifests
kubectl get pods              # List pods
kubectl logs -f <pod-name>    # View pod logs
kubectl describe pod <pod-name> # Get pod details
kubectl port-forward <pod> 3000:3000  # Port forwarding
```

### Ansible
```bash
ansible-playbook ansible/playbooks/deploy.yml -i ansible/inventory/hosts.ini
ansible-playbook ansible/playbooks/configure-server.yml -i ansible/inventory/hosts.ini
ansible all -i ansible/inventory/hosts.ini -m ping  # Test connectivity
```

### Jenkins
- Dashboard: `http://jenkins-server:8080`
- View logs: `Settings → System Logs`
- Manual trigger: Click "Build Now"

---

## Troubleshooting Guide

### Common Issues

**Container fails to start:**
- Check environment variables
- Verify database connectivity
- Review logs: `docker-compose logs <service>`

**Kubernetes pod pending:**
- Check resource availability
- Verify image pulls: `kubectl describe pod <pod-name>`
- Check node capacity: `kubectl top nodes`

**ELK Stack not receiving logs:**
- Verify Logstash connectivity
- Check firewall rules
- Review Logstash pipeline configuration

**Vault connection fails:**
- Verify Vault service is running
- Check authentication token
- Review network policies

---

## Documentation Files to Create

1. **Architecture Diagram** - System design and component interactions
2. **Setup Guide** - Step-by-step installation instructions
3. **Configuration Reference** - All configurable parameters
4. **API Documentation** - Backend API endpoints
5. **Troubleshooting Guide** - Common issues and solutions
6. **Operational Procedures** - Daily operations and runbooks
7. **Security Documentation** - Security best practices and policies

---

## Summary

This implementation provides:
- ✅ Containerization with Docker & Docker Compose
- ✅ CI/CD automation with Jenkins
- ✅ Infrastructure as Code with Ansible
- ✅ Orchestration with Kubernetes & HPA
- ✅ Monitoring with ELK Stack
- ✅ Security with HashiCorp Vault
- ✅ High availability and auto-scaling
- ✅ Production-ready deployment pipeline

All components are interconnected and work together to provide a complete DevOps solution for application deployment, monitoring, and management.
