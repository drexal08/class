import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
