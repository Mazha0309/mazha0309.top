import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getMigrations } from "better-auth/db/migration";
import { auth, closeAuthPool } from "../app/lib/auth.server";
import { getDb, getPool } from "../app/lib/db.server";

async function main() {
  const pool = getPool();
  console.log("Migration phase 1/4: preparing PostgreSQL extensions and schemas.");
  await pool.query("create extension if not exists pg_trgm");
  await pool.query("create schema if not exists auth");

  console.log("Migration phase 2/4: checking Better Auth schema.");
  const authMigrations = await getMigrations(auth.options);
  await authMigrations.runMigrations();

  console.log("Migration phase 3/4: applying application migrations.");
  await migrate(getDb(), { migrationsFolder: "drizzle" });

  console.log("Migration phase 4/4: refreshing search indexes.");
  // Keep trigram expressions to immutable functions accepted by PostgreSQL.
  await pool.query(`
    create index if not exists posts_title_trgm_idx
      on posts using gin (lower(title) gin_trgm_ops)
  `);
  await pool.query(`
    create index if not exists posts_summary_trgm_idx
      on posts using gin (lower(summary) gin_trgm_ops)
  `);
  await pool.query(`
    create index if not exists posts_body_trgm_idx
      on posts using gin (lower(content_text) gin_trgm_ops)
  `);
  await pool.query(`
    create index if not exists posts_tags_gin_idx
      on posts using gin (tags)
  `);
  await pool.query(`
    create index if not exists projects_title_trgm_idx
      on projects using gin (lower(title) gin_trgm_ops)
  `);
  await pool.query(`
    create index if not exists projects_summary_trgm_idx
      on projects using gin (lower(summary) gin_trgm_ops)
  `);
  await pool.query(`
    create index if not exists projects_stack_gin_idx
      on projects using gin (stack)
  `);

  console.log("Database migrations complete.");
  await closeAuthPool();
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await closeAuthPool().catch(() => undefined);
  await getPool().end().catch(() => undefined);
  process.exitCode = 1;
});
