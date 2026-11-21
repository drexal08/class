#!/usr/bin/env node
/**
 * Patch the generated Prisma client to inline the wasm query compiler.
 * This avoids the "Module not found: file:///bundle/..." error on Cloudflare Workers.
 * The wasm is loaded from the base64 string instead of an external import.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const classTsPath = resolve("src/generated/prisma/internal/class.ts");
const wasmBase64Path = resolve("node_modules/@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
const wasmLoaderPath = resolve("node_modules/@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs");

if (!existsSync(classTsPath)) {
  console.error("class.ts not found at", classTsPath);
  process.exit(1);
}

if (!existsSync(wasmBase64Path)) {
  console.error("wasm-base64.mjs not found at", wasmBase64Path);
  process.exit(1);
}

const classTs = readFileSync(classTsPath, "utf8");
const wasmBase64Content = readFileSync(wasmBase64Path, "utf8");
const wasmLoaderContent = readFileSync(wasmLoaderPath, "utf8");

// Extract the base64 string from the wasm-base64.mjs file
const wasmBase64Match = wasmBase64Content.match(/const wasm = "([^"]+)"/);
if (!wasmBase64Match) {
  console.error("Could not extract wasm base64 string");
  process.exit(1);
}
const wasmBase64 = wasmBase64Match[1];

// Extract the loader exports from the wasm loader
const exportMatch = wasmLoaderContent.match(/export\{([^}]+)\}/);
if (!exportMatch) {
  console.error("Could not extract wasm loader exports");
  process.exit(1);
}
const wasmExports = exportMatch[1];

// Find the config.compilerWasm block and replace it
const compilerWasmRegex = /config\.compilerWasm = \{[\s\S]*?\n\}/;
const newCompilerWasm = `config.compilerWasm = {
  getRuntime: async () => {
    // Inline the wasm loader to avoid external module loading on Workers
    const wasmBase64 = "${wasmBase64}";
    const { Buffer } = await import('node:buffer');
    const wasmArray = Buffer.from(wasmBase64, 'base64');
    const wasmModule = new WebAssembly.Module(wasmArray);
    const wasmInstance = new WebAssembly.Instance(wasmModule, {
      "./query_compiler_fast_bg.js": {
        ${wasmExports}
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
  console.error("Could not find compilerWasm block to patch");
  process.exit(1);
}

writeFileSync(classTsPath, patched);
console.log("Patched src/generated/prisma/internal/class.ts with inlined wasm compiler");