FROM oven/bun:1-slim

WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
RUN bun install --production --frozen-lockfile
COPY src ./src
COPY migrations ./migrations

ENV PORT=3001
EXPOSE 3001

USER bun
CMD ["bun", "run", "src/index.ts"]
