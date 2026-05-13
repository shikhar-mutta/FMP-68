# ─────────────────────────────────────────────────────────────
# Custom Jenkins image for FMP-68 CI/CD
#   - Jenkins LTS (JDK 17)
#   - docker CLI (uses mounted /var/run/docker.sock)
#   - kubectl + minikube CLI (deploy to the host's Minikube)
#   - Node.js 20 (run npm ci/test/build inside the same agent)
#   - jenkins user added to docker group (GID 124 — matches host)
# ─────────────────────────────────────────────────────────────
FROM jenkins/jenkins:lts-jdk17

ARG DOCKER_GID=124

USER root

# Tools layer: docker CLI, node 20, basics
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg lsb-release jq \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
 && chmod a+r /etc/apt/keyrings/docker.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
         https://download.docker.com/linux/debian $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" \
        > /etc/apt/sources.list.d/docker.list \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli nodejs \
 && rm -rf /var/lib/apt/lists/*

# kubectl
RUN curl -fsSLo /usr/local/bin/kubectl https://dl.k8s.io/release/v1.30.0/bin/linux/amd64/kubectl \
 && chmod +x /usr/local/bin/kubectl

# minikube CLI
RUN curl -fsSLo /usr/local/bin/minikube \
        https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 \
 && chmod +x /usr/local/bin/minikube

# Add jenkins user to docker group (GID must match host's)
RUN groupadd -f -g ${DOCKER_GID} docker \
 && usermod -aG docker jenkins

USER jenkins
