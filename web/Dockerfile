FROM oven/bun:1-slim AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY vite.config.ts tsconfig.json ./
COPY src ./src
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
# The agile project screens are built in only when this is true, because Vite reads it at build time.
ARG VITE_AGILE_PROJECT=false
ENV VITE_AGILE_PROJECT=$VITE_AGILE_PROJECT
# CLOUD-001: the team standard screens (epic space, ticket codes, role lanes, timeline), also read at build time.
ARG VITE_ARTIFACT_STANDARD=false
ENV VITE_ARTIFACT_STANDARD=$VITE_ARTIFACT_STANDARD
RUN bun run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
