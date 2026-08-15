import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These do dynamic requires and ship optional native binaries, which bundlers
  // choke on. Keeping them external lets Node resolve them at runtime instead.
  serverExternalPackages: [
    "firebase-admin",
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
  ],

  images: {
    remotePatterns: [
      // Google account photos, used as avatars after Google sign-in.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
