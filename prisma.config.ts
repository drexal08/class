import { config as loadEnvFile } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env for local development only. On a hosting platform the environment
// is injected directly, and reading a stray uploaded .env would override it —
// which silently points Migrate at localhost instead of the real database.
if (!process.env.VERCEL && !process.env.CI) {
  loadEnvFile();
}

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
    // Migrate needs an unpooled connection. Providers name it differently:
    // Supabase wants :5432 in DIRECT_URL, while Vercel's Neon integration
    // injects DATABASE_URL_UNPOOLED automatically — accept either, so neither
    // needs manual wiring.
    url:
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      PLACEHOLDER,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
