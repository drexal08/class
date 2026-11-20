import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next's client router cache defaults to zero for dynamic routes, so every
    // tab switch refetches the whole RSC payload. A short window makes moving
    // back and forth between Stream, Classwork, People and Grades instant
    // without serving stale data for long.
    staleTimes: { dynamic: 30, static: 300 },

    // lucide-react and date-fns are barrel packages; this rewrites the imports
    // so a page only ships the icons and helpers it actually uses.
    optimizePackageImports: ["lucide-react", "date-fns"],
  },

  // Prisma and pg ship native binaries, so Node resolves them at runtime.
  //
  // firebase-admin is deliberately NOT listed. It depends on jwks-rsa, which
  // `require()`s jose v6 — a pure-ESM package. Marking it external makes Node
  // load that chain raw at runtime and fail with ERR_REQUIRE_ESM on every
  // request. Letting the bundler resolve the import instead avoids it.
  //
  // @prisma/adapter-pg and pg must NOT be externalized for Cloudflare Workers:
  // the Worker build cannot load them as external modules. They are safe to
  // bundle because they have no native dependencies that break on workerd
  // (unlike @prisma/client which uses a wasm query compiler).
  //
  // @prisma/client is also NOT externalized: the wasm query compiler cannot be
  // loaded as an external module on Cloudflare Workers. Bundling it works
  // because the binary engine (engineType = "binary" in schema.prisma) avoids
  // the wasm compiler at runtime, but the wasm file must still be present in
  // the bundle for the client to load.
  serverExternalPackages: [],

  // firebase-admin ships in Next's built-in externals list, so omitting it
  // above is not enough — that list is added to, not replaced. Naming it here
  // opts it out and forces the bundler to resolve the jose ESM import at build
  // time instead of leaving a runtime require() that cannot.
  //
  // pg must also be transpiled/bundled for Cloudflare Workers: the Prisma
  // adapter imports it, and the Worker build cannot load it as an external
  // module.
  transpilePackages: ["firebase-admin", "pg"],

  images: {
    remotePatterns: [
      // Google account photos, used as avatars after Google sign-in.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  /**
   * The signed-in landing shortcut.
   *
   * This used to be the first branch of `proxy.ts`: a visitor who arrives at
   * `/` carrying a `__session` cookie is handed to `/api/auth/landing`, which
   * verifies the cookie for real — a live session goes to the dashboard, a dead
   * one is cleared and the visitor stays put. The route also sets
   * `__landing_checked` for a few seconds when it cannot clear the cookie, and
   * `missing` below is what stops the redirect loop in that case.
   *
   * It lives in a rewrite rather than middleware because Next 16 runs
   * `proxy.ts` on the Node.js runtime only, and the Cloudflare Workers adapter
   * cannot build Node middleware at all. Cookie conditions keep `/` a static
   * document, so anonymous visitors still never touch the database.
   */
  async rewrites() {
    return {
      /**
       * `beforeFiles` is required, not stylistic: an `afterFiles` rewrite is
       * only consulted when nothing on disk matched, and `/` is a prerendered
       * page — it always matches. The redirect would silently never fire.
       */
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "cookie", key: "__session" }],
          missing: [{ type: "cookie", key: "__landing_checked" }],
          destination: "/api/auth/landing?next=/",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
