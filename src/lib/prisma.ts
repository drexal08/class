import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

import { isCloudflareWorkers, getCloudflareBindings } from "@/lib/cloudflare";

/**
 * Lazy Prisma singleton.
 *
 * Prisma 7 requires a driver adapter — the connection string is no longer read
 * from `schema.prisma`, it is handed to the client at construction time.
 *
 * Construction is deferred behind a Proxy because Next.js imports every module
 * in the graph during `next build`; a top-level client would make a production
 * build depend on a reachable database. The first *property access* (i.e. the
 * first real query, at request time) creates it.
 *
 * The instance is cached on `globalThis` so hot-reload in development does not
 * open a new connection pool on every edit.
 */
const globalForPrisma = globalThis as unknown as {
  __lmsPrisma?: PrismaClient;
};

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Copy .env.example to .env and add a PostgreSQL connection string (see SETUP.md).",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

function createClient(): PrismaClient {
  // On Cloudflare Workers with Hyperdrive, use the Hyperdrive connection string.
  // Hyperdrive exposes the connection string via the binding object.
  let connectionString = process.env.DATABASE_URL;
  if (isCloudflareWorkers()) {
    const bindings = getCloudflareBindings();
    const hyperdrive = bindings?.HYPERDRIVE as { connectionString?: string } | undefined;
    if (hyperdrive?.connectionString) {
      connectionString = hyperdrive.connectionString;
    }
  }
  if (!connectionString) throw new DatabaseNotConfiguredError();

  const adapter = new PrismaPg({
    connectionString,
    // Workers must not reuse a socket across requests. Closing the connection
    // after every query keeps an idle client from leaking into the next
    // invocation; on Node/Vercel the pool behaves normally.
    ...(isCloudflareWorkers() ? { maxUses: 1 } : {}),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    if (!globalForPrisma.__lmsPrisma) {
      globalForPrisma.__lmsPrisma = createClient();
    }
    const value = Reflect.get(globalForPrisma.__lmsPrisma, property, receiver);
    return typeof value === "function"
      ? value.bind(globalForPrisma.__lmsPrisma)
      : value;
  },
});
