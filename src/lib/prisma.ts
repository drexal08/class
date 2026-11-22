import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma } from "@/generated/prisma/client";

import { isCloudflareWorkers, getCloudflareBindings } from "@/lib/cloudflare";
import { createLazyClientProxy } from "@/lib/lazy-client-proxy";

// The two generated clients are structurally incompatible at the generic type
// level. Keep this dynamic boundary erased; feature modules retain their own
// explicit DTO types instead of recursing through two Prisma type universes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

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
 * On Cloudflare Workers we use the workerd-specific client (runtime = "workerd")
 * which uses static WASM imports instead of `new WebAssembly.Module(base64)`.
 * On Node/Vercel we use the default client.
 *
 * The instance is cached on `globalThis` so hot-reload in development does not
 * open a new connection pool on every edit.
 */
const globalForPrisma = globalThis as unknown as {
  __lmsPrismaPromise?: Promise<PrismaClient>;
};

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Copy .env.example to .env and add a PostgreSQL connection string (see SETUP.md).",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

async function createClient(): Promise<PrismaClient> {
  // On Cloudflare Workers with Hyperdrive, use the Hyperdrive connection string.
  // Hyperdrive exposes the connection string via the binding object.
  let connectionString = process.env.DATABASE_URL;
  if (isCloudflareWorkers()) {
    const bindings = getCloudflareBindings();
    const hyperdrive = bindings?.HYPERDRIVE as
      | { connectionString?: string }
      | undefined;
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

  const log: Prisma.LogLevel[] = process.env.NODE_ENV === "development"
    ? ["warn", "error"]
    : ["error"];
  const options = { adapter, log };

  // The Workers alias points @prisma/client at the workerd-generated client.
  // Node/Vercel must use this project's custom generated output, not the
  // uninitialized @prisma/client package stub. Keep the branches separate so
  // TypeScript never has to unify the two generated constructor signatures.
  if (isCloudflareWorkers()) {
    const { PrismaClient: WorkerdClient } = await import("@prisma/client");
    return new WorkerdClient(options);
  }
  const { PrismaClient: NodeClient } = await import("@/generated/prisma/client");
  return new NodeClient(options);
}

async function loadClient(): Promise<PrismaClient> {
  globalForPrisma.__lmsPrismaPromise ??= createClient().catch((error: unknown) => {
    delete globalForPrisma.__lmsPrismaPromise;
    throw error;
  });
  return globalForPrisma.__lmsPrismaPromise;
}

export const prisma = createLazyClientProxy<PrismaClient>(loadClient);
