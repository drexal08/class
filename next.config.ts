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
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

  // firebase-admin ships in Next's built-in externals list, so omitting it
  // above is not enough — that list is added to, not replaced. Naming it here
  // opts it out and forces the bundler to resolve the jose ESM import at build
  // time instead of leaving a runtime require() that cannot.
  transpilePackages: ["firebase-admin"],

  images: {
    remotePatterns: [
      // Google account photos, used as avatars after Google sign-in.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
