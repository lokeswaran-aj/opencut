# Build context must be the MONOREPO ROOT:
#   docker build -f apps/render-worker/Dockerfile .
#
# In Coolify: set "Dockerfile Location" to apps/render-worker/Dockerfile
# and leave the build context as the repository root (default).

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# ── System packages ──────────────────────────────────────────────────────────
# FFmpeg (video encoding) + shared libs required by Remotion's chrome-headless-shell
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    ffmpeg \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

# ── Bun ──────────────────────────────────────────────────────────────────────
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# ── pnpm ─────────────────────────────────────────────────────────────────────
# Bun ships with npm; use it to bootstrap pnpm
RUN curl -fsSL https://get.pnpm.io/install.sh | ENV='' PROFILE=/dev/null bash
ENV PATH="/root/.local/share/pnpm:$PATH"

# ── Dependencies (layer-cached separately from source) ───────────────────────
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/render-worker/package.json ./apps/render-worker/package.json
COPY apps/web/package.json          ./apps/web/package.json

# pnpm install also runs @remotion/renderer postinstall which downloads
# chrome-headless-shell for linux-x64 — this is what renders the video.
RUN pnpm install --frozen-lockfile

# ── Source code ───────────────────────────────────────────────────────────────
# node_modules are excluded via .dockerignore; the installed ones above are kept.
COPY . .

# ── Runtime ───────────────────────────────────────────────────────────────────
EXPOSE 8787

WORKDIR /app/apps/render-worker

CMD ["bun", "run", "src/index.ts"]
