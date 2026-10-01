FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.25.0
