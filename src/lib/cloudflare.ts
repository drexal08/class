/**
 * Cloudflare Workers detection and bindings access.
 *
 * This module has no server-only or external dependencies and can be safely
 * imported by both server and client code (though the bindings themselves
 * are only available at runtime on the server).
 */

/**
 * True inside workerd (Cloudflare Workers runtime).
 *
 * `wrangler.jsonc` sets `DEPLOYMENT_TARGET=cloudflare`; the user-agent check
 * covers `opennextjs-cloudflare preview` and any Worker where the variable was
 * not copied across. Vercel sets neither, so its Node path is unchanged.
 */
export function isCloudflareWorkers(): boolean {
  if (process.env.DEPLOYMENT_TARGET === "cloudflare") return true;
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  );
}

/**
 * Get Cloudflare Worker bindings from the OpenNext AsyncLocalStorage context.
 * Returns the `env` object that contains bindings like HYPERDRIVE, R2 buckets, etc.
 * Only available when running inside a Cloudflare Worker (including OpenNext preview).
 */
export function getCloudflareBindings(): Record<string, unknown> | null {
  if (!isCloudflareWorkers()) return null;
  const symbol = Symbol.for("__cloudflare-context__");
  // Use Reflect.get to avoid TypeScript indexing issues with symbols on globalThis
  const ctx = Reflect.get(globalThis, symbol) as
    | { env?: Record<string, unknown> }
    | undefined;
  return ctx?.env ?? null;
}