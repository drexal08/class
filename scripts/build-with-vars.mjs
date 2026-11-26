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
// This is only needed for the default client on platforms where
// new WebAssembly.Module() is not available (Cloudflare Workers).
// On Cloudflare Workers we use the workerd-specific client (runtime = "workerd")
// which uses static WASM imports instead, so we skip the patch.
// On Vercel/Node.js, Prisma 7's inlineWasm = true handles WASM inlining automatically.
function patchPrismaWasm() {
  // Skip patch for Cloudflare Workers builds - we use the workerd client
  // which has static WASM imports and doesn't need this patch.
  // Also skip for Vercel/Node.js builds - inlineWasm = true handles it.
  if (process.env.DEPLOYMENT_TARGET === "cloudflare" || process.env.VERCEL === "1" || !process.env.DEPLOYMENT_TARGET) {
    if (process.env.DEPLOYMENT_TARGET === "cloudflare") {
      console.log("Skipping Prisma WASM patch for Cloudflare Workers (using workerd client)");
      // Instead, patch the workerd client to use our workerd-compatible runtime shim
      patchWorkerdClientRuntime();
    } else {
      console.log("Skipping Prisma WASM patch for Vercel/Node.js (inlineWasm = true handles it)");
    }
    return;
  }

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

// Patch the workerd client's internal/class.ts to use our workerd-compatible runtime shim
// instead of @prisma/client/runtime/wasm-compiler-edge which uses new WebAssembly.Module()
function patchWorkerdClientRuntime() {
  const workerdClassTsPath = resolve("src/generated/prisma-workerd/internal/class.ts");
  const workerdClientTsPath = resolve("src/generated/prisma-workerd/client.ts");
  
  if (!existsSync(workerdClassTsPath)) {
    console.warn("workerd class.ts not found, skipping runtime patch");
    return;
  }

  let classTs = readFileSync(workerdClassTsPath, "utf8");
  
  // Replace the import of @prisma/client/runtime/wasm-compiler-edge with our shim
  const originalImport = 'import * as runtime from "@prisma/client/runtime/wasm-compiler-edge"';
  const shimImport = 'import * as runtime from "@/lib/prisma-workerd-runtime"';
  
  if (classTs.includes(originalImport)) {
    classTs = classTs.replace(originalImport, shimImport);
    writeFileSync(workerdClassTsPath, classTs);
    console.log("Patched workerd client internal/class.ts to use workerd-compatible runtime shim");
  } else {
    console.warn("Could not find expected import in workerd class.ts, skipping runtime patch");
  }

  // Also patch client.ts which imports the edge runtime for types
  if (existsSync(workerdClientTsPath)) {
    let clientTs = readFileSync(workerdClientTsPath, "utf8");
    const clientOriginalImport = 'import * as runtime from "@prisma/client/runtime/wasm-compiler-edge"';
    const clientShimImport = 'import * as runtime from "@/lib/prisma-workerd-runtime"';
    
    if (clientTs.includes(clientOriginalImport)) {
      clientTs = clientTs.replace(clientOriginalImport, clientShimImport);
      writeFileSync(workerdClientTsPath, clientTs);
      console.log("Patched workerd client client.ts to use workerd-compatible runtime shim");
    } else {
      console.warn("Could not find expected import in workerd client.ts, skipping runtime patch");
    }
  }
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

if (buildResult.status !== 0) {
  process.exit(buildResult.status);
}

// Patch .next/server/ files to fix versioned Prisma runtime imports
console.log("Patching .next/server/ files...");
const patchResult = spawnSync("node", ["scripts/patch-next-server.mjs"], {
  stdio: "inherit",
  shell: true,
});

if (patchResult.status !== 0) {
  console.error("Patching .next/server/ files failed");
  process.exit(patchResult.status);
}

process.exit(0);