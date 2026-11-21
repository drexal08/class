#!/usr/bin/env node
/**
 * Build script that ensures NEXT_PUBLIC_* variables are available during build
 * and patches the Prisma client to inline the wasm query compiler for Cloudflare Workers.
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { resolve } from "path";

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

// Patch Prisma client to inline wasm query compiler
function patchPrismaWasm() {
  const classTsPath = resolve("src/generated/prisma/internal/class.ts");
  const wasmBase64Path = resolve("node_modules/@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
  const wasmLoaderPath = resolve("node_modules/@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs");

  if (!existsSync(classTsPath)) {
    console.warn("class.ts not found, skipping wasm patch");
    return;
  }
  if (!existsSync(wasmBase64Path) || !existsSync(wasmLoaderPath)) {
    console.warn("wasm files not found, skipping wasm patch");
    return;
  }

  const classTs = readFileSync(classTsPath, "utf8");
  const wasmBase64Content = readFileSync(wasmBase64Path, "utf8");
  const wasmLoaderContent = readFileSync(wasmLoaderPath, "utf8");

  const wasmBase64Match = wasmBase64Content.match(/const wasm = "([^"]+)"/);
  if (!wasmBase64Match) {
    console.warn("Could not extract wasm base64 string, skipping patch");
    return;
  }
  const wasmBase64 = wasmBase64Match[1];

  const exportMatch = wasmLoaderContent.match(/export\{([^}]+)\}/);
  if (!exportMatch) {
    console.warn("Could not extract wasm loader exports, skipping patch");
    return;
  }
  const wasmExports = exportMatch[1].trim();

  // Build the imports object as valid JS
  const importsObj = wasmExports
    .split(",")
    .map(e => e.trim())
    .filter(e => e)
    .map(e => {
      const [alias, name] = e.split(" as ").map(s => s.trim());
      return `        ${alias}: ${name}`;
    })
    .join(",\n");

  const compilerWasmRegex = /config\.compilerWasm = \{[\s\S]*?\n\}/;
  const newCompilerWasm = `config.compilerWasm = {
  getRuntime: async () => {
    const wasmBase64 = "${wasmBase64}";
    const { Buffer } = await import('node:buffer');
    const wasmArray = Buffer.from(wasmBase64, 'base64');
    const wasmModule = new WebAssembly.Module(wasmArray);
    const wasmInstance = new WebAssembly.Instance(wasmModule, {
      "./query_compiler_fast_bg.js": {
${importsObj}
      }
    });
    const runtime = wasmInstance.exports;
    return runtime;
  },

  getQueryCompilerWasmModule: async () => {
    const wasmBase64 = "${wasmBase64}";
    const { Buffer } = await import('node:buffer');
    const wasmArray = Buffer.from(wasmBase64, 'base64');
    return new WebAssembly.Module(wasmArray);
  },

  importName: "./query_compiler_fast_bg.js"
}`;

  const patched = classTs.replace(compilerWasmRegex, newCompilerWasm);

  if (patched === classTs) {
    console.warn("Could not find compilerWasm block to patch");
    return;
  }

  writeFileSync(classTsPath, patched);
  console.log("Patched Prisma client with inlined wasm query compiler");
}

// Run prisma generate first
console.log("Running prisma generate...");
const generateResult = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  shell: true,
});

if (generateResult.status !== 0) {
  console.error("prisma generate failed");
  process.exit(generateResult.status);
}

// Patch the generated client
patchPrismaWasm();

// Now run the actual build
console.log("Running next build...");
const buildResult = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
});

process.exit(buildResult.status);