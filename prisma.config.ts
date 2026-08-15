import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * Connection strings moved out of `schema.prisma` in v7 and are no longer read
 * from the environment automatically, hence the explicit `dotenv/config` import
 * above.
 *
 * The placeholder fallback keeps credential-free commands working: `prisma
 * generate` and `prisma validate` run during `npm install` and `npm run build`,
 * where no database is configured. Commands that actually touch a database
 * (`migrate`, `db push`, `studio`) still require a real DATABASE_URL.
 */
const PLACEHOLDER = "postgresql://user:password@localhost:5432/postgres";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Supabase serves pooled connections on :6543 (pgbouncer), but Migrate needs
    // a direct :5432 connection — set DIRECT_URL to that one.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || PLACEHOLDER,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
