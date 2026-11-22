#!/usr/bin/env node
/**
 * Patch the .next/server/ files to replace versioned Prisma runtime imports
 * with our workerd-compatible shim.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";

const nextServerDir = resolve(".next/server");
const shimPath = "./src/lib/prisma-workerd-runtime";

if (!existsSync(nextServerDir)) {
  console.log("No .next/server directory found, skipping patch");
  process.exit(0);
}

function patchFile(filePath) {
  let content = readFileSync(filePath, "utf8");
  let patched = false;

  // Replace versioned Prisma runtime imports (ES modules)
  const versionedImportRegex = /from\s+["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']/g;
  if (versionedImportRegex.test(content)) {
    content = content.replace(versionedImportRegex, `from "${shimPath}"`);
    patched = true;
  }

  // Replace standard Prisma runtime imports (ES modules)
  const standardImportRegex = /from\s+["']@prisma\/client\/runtime\/wasm-compiler-edge["']/g;
  if (standardImportRegex.test(content)) {
    content = content.replace(standardImportRegex, `from "${shimPath}"`);
    patched = true;
  }

  // Replace require() calls
  const versionedRequireRegex = /require\(["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']\)/g;
  if (versionedRequireRegex.test(content)) {
    content = content.replace(versionedRequireRegex, `require("${shimPath}")`);
    patched = true;
  }

  const standardRequireRegex = /require\(["']@prisma\/client\/runtime\/wasm-compiler-edge["']\)/g;
  if (standardRequireRegex.test(content)) {
    content = content.replace(standardRequireRegex, `require("${shimPath}")`);
    patched = true;
  }

  // Replace dynamic imports (e.y() calls from esbuild)
  const versionedDynamicImportRegex = /e\.y\(["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']\)/g;
  if (versionedDynamicImportRegex.test(content)) {
    content = content.replace(versionedDynamicImportRegex, `e.y("${shimPath}")`);
    patched = true;
  }

  const standardDynamicImportRegex = /e\.y\(["']@prisma\/client\/runtime\/wasm-compiler-edge["']\)/g;
  if (standardDynamicImportRegex.test(content)) {
    content = content.replace(standardDynamicImportRegex, `e.y("${shimPath}")`);
    patched = true;
  }

  if (patched) {
    writeFileSync(filePath, content);
    console.log(`Patched: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith(".js") || file.endsWith(".mjs")) {
      patchFile(fullPath);
    }
  }
}

console.log("Patching .next/server/ files...");
walkDir(nextServerDir);
console.log("Done patching .next/server/ files");