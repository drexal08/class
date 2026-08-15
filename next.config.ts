import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma and pg ship native binaries, so Node resolves them at runtime.
  //
  // firebase-admin is deliberately NOT listed. It depends on jwks-rsa, which
  // `require()`s jose v6 — a pure-ESM package. Marking it external makes Node
  // load that chain raw at runtime and fail with ERR_REQUIRE_ESM on every
  // request. Letting the bundler resolve the import instead avoids it.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

  images: {
    remotePatterns: [
      // Google account photos, used as avatars after Google sign-in.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
