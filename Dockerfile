# syntax=docker/dockerfile:1
#
# Backend image: Ponder indexer + Hono API.
#
# There is no compile step. @ens-dis/domain exports raw TypeScript
# ("exports": "./src/index.ts") and Ponder loads apps/backend/src directly, so
# this is a runtime image rather than a builder/runner split.

FROM node:20-bookworm-slim

# corepack reads the root "packageManager" field and pins pnpm 9.15.0.
# Must run as root; everything after this runs as the unprivileged node user.
RUN corepack enable

RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

# Manifests first, so the dependency layer is cached independently of source.
# Every workspace manifest must be present for --frozen-lockfile to validate
# the lockfile, including the frontend's, which we otherwise never install.
COPY --chown=node:node pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY --chown=node:node apps/backend/package.json apps/backend/
COPY --chown=node:node apps/frontend/package.json apps/frontend/
COPY --chown=node:node packages/domain/package.json packages/domain/

# --prod=false is REQUIRED: Ponder compiles ponder.config.ts with tsx, which is
# a devDependency. Without it the container exits with status 2 before Ponder
# logs anything. Same trap documented in nixpacks.toml.
#
# The trailing "..." on the filter selects the backend plus its workspace
# dependencies, skipping the frontend's Vite and Playwright toolchain.
RUN pnpm install --filter @ens-dis/backend... --frozen-lockfile --prod=false

COPY --chown=node:node packages/domain packages/domain
COPY --chown=node:node apps/backend apps/backend

# Set after the install so it can never cause pnpm to drop devDependencies.
ENV NODE_ENV=production
ENV PORT=42069

EXPOSE 42069

# /health is one of Ponder's reserved routes and answers as soon as the server
# is listening. Liveness only — use /ready to tell whether indexing has caught
# up, which takes hours on a cold database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||42069)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "--filter", "@ens-dis/backend", "start"]
