#!/usr/bin/env node
/**
 * Patch the final bundled worker.js to replace versioned Prisma runtime imports
 * with our workerd-compatible shim.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const workerPath = resolve(".open-next/worker.js");
const shimPath = "./src/lib/prisma-workerd-runtime";

if (!existsSync(workerPath)) {
  console.log("No .open-next/worker.js found, skipping patch");
  process.exit(0);
}

let content = readFileSync(workerPath, "utf8");
let patched = false;

// Replace versioned Prisma runtime imports
const versionedImportRegex = /from\s+["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']/g;
if (versionedImportRegex.test(content)) {
  content = content.replace(versionedImportRegex, `from "${shimPath}"`);
  patched = true;
  console.log("Patched versioned import");
}

// Replace standard Prisma runtime imports
const standardImportRegex = /from\s+["']@prisma\/client\/runtime\/wasm-compiler-edge["']/g;
if (standardImportRegex.test(content)) {
  content = content.replace(standardImportRegex, `from "${shimPath}"`);
  patched = true;
  console.log("Patched standard import");
}

// Replace require() calls
const versionedRequireRegex = /require\(["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']\)/g;
if (versionedRequireRegex.test(content)) {
  content = content.replace(versionedRequireRegex, `require("${shimPath}")`);
  patched = true;
  console.log("Patched versioned require");
}

const standardRequireRegex = /require\(["']@prisma\/client\/runtime\/wasm-compiler-edge["']\)/g;
if (standardRequireRegex.test(content)) {
  content = content.replace(standardRequireRegex, `require("${shimPath}")`);
  patched = true;
  console.log("Patched standard require");
}

if (patched) {
  writeFileSync(workerPath, content);
  console.log("Patched .open-next/worker.js");
} else {
  console.log("No patches needed");
}