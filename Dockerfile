# Sparkflow in the cloud: the server (Next.js app + agent) on Cloud Run. Each app's sandbox (Expo, Metro,
# Playwright captures) runs on Modal, built from templates/expo-base; this image needs neither.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# typescript is a dev dependency but the server parses the apps' code with it (Layout, rename): kept.
RUN npm run build && npm prune --omit=dev && npm install --no-save --no-audit --no-fund "typescript@$(node -p "require('./package.json').devDependencies.typescript")"

FROM node:22-bookworm-slim
# git and tar: the Modal driver packs the app template from here.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production SPARKFLOW_CLOUD=1 SPARKFLOW_SANDBOX=modal SPARKFLOW_DATA_DIR=/data NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app /app
EXPOSE 8080
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-8080}"]
