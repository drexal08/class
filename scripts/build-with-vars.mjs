#!/usr/bin/env node
/**
 * Build script that ensures NEXT_PUBLIC_* variables are available during build.
 * Cloudflare dashboard build-time variables may not reach npm process.
 * This script reads from process.env and writes a .env.production file
 * that Next.js will pick up during build.
 */

import { writeFileSync } from "fs";
import { spawnSync } from "child_process";

const requiredVars = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_PUSHER_KEY",
  "NEXT_PUBLIC_PUSHER_CLUSTER",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
];

const envContent = requiredVars
  .map((key) => {
    const value = process.env[key];
    if (!value) {
      console.warn(`Warning: ${key} not set in environment`);
      return null;
    }
    return `${key}=${value}`;
  })
  .filter(Boolean)
  .join("\n");

writeFileSync(".env.production", envContent + "\n");
console.log("Written .env.production with", requiredVars.filter((k) => process.env[k]).length, "variables");

// Now run the actual build
const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status);