FROM node:22

RUN apt-get update && apt-get install -y docker.io

WORKDIR /workspace