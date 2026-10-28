# Data, migrations, and performance

Read this when you write SQL, change the schema, add a transaction, or add a list endpoint.

## SQL

- Use the tagged template from `bun` (`sql\`...\``) with parameters. Never build SQL by concatenating strings.
- SQL lives only in `repositories/`. Services call repository functions and do not write SQL.
- Repositories return typed rows. Map database names (`created_at`, `parent_ids`) to camelCase in the repository.
- Give each repository function a single job: find, insert, update, delete. Keep functions short.
- Select only the columns you need. No `SELECT *` in repositories.

## Migrations

- Every schema change is a new file in `migrations/`, named `NNNN_short_name.sql`, for example `0002_password_resets.sql`.
- Never edit a migration that has been applied anywhere. Add a new one to fix it.
- The runner applies pending migrations at startup, in order. Each migration runs in its own transaction.
- A table `schema_migrations(version, name, checksum, applied_at)` records what ran. The runner stops with an error if an applied file's checksum changed.
- Migrations are written to be safe on a live database: add columns as nullable or with a default, build indexes concurrently when the table is large, and do data changes in a separate migration from schema changes.
- `schema.sql` is replaced by the numbered migrations. Until that is done, `schema.sql` stays idempotent and is only used for the first run.

## Transactions

- Use `db.begin` in the service layer when two or more writes must succeed together.
- Keep transactions short. Do no network calls, no email, no hashing inside a transaction. Argon2 and email happen before or after.
- Lock rows with `FOR UPDATE` only when a read-then-write depends on the value read. The sync push and invite accept routes already do this.
- Do not catch and ignore errors inside a transaction. Let it roll back.

## Performance

- **Every list endpoint paginates.** Workspaces, members, invites, and history take `limit` (max 100) and an opaque cursor. Today the workspace list and member list are unbounded. Fix them when you touch them.
- **Index every foreign key and every column used in `WHERE`, `JOIN`, or `ORDER BY`.** Check with `EXPLAIN` before adding an index.
- **Avoid N+1.** Load related rows with one query and a join or `ANY($1)`, not one query per row.
- **Large JSON.** Workspace snapshots are stored as JSONB. Read the snapshot only on routes that need it. Listing routes must not read snapshots.
- **Timeouts.** Set `statement_timeout` on the connection (`DB_STATEMENT_TIMEOUT_MS`, default 5000). A slow query fails fast with a clear error instead of holding a connection.
- **Pool.** Set the pool size with `DB_POOL_MAX`. Log pool wait time when metrics exist.
- **Body limits.** Set the request body limit per route. Sync push is the only route allowed a large body.
- **Caching.** Do not cache user-specific data in memory. Any future cache must be keyed by user and invalidated on write.
- **Rate limiter** is in process memory. It is correct for one instance only. Move it to a shared store before running two instances.

## Measure before you optimize

Add a timing log for any query over 200 ms. Use `EXPLAIN (ANALYZE, BUFFERS)` on the query before changing it. Write the expected row count in the test for any list endpoint.
