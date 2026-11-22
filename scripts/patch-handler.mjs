#!/usr/bin/env node
/**
 * Patch the final OpenNext handler.mjs to replace versioned Prisma runtime imports
 * with our workerd-compatible shim.
 * Run this after OpenNext's build step.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const handlerPath = resolve(".open-next/server-functions/default/handler.mjs");
const shimPath = "./src/lib/prisma-workerd-runtime";

if (!existsSync(handlerPath)) {
  console.error("Handler file not found:", handlerPath);
  process.exit(1);
}

let content = readFileSync(handlerPath, "utf8");
let patched = false;

// Pattern 1: e.y("@prisma/client-<hash>/runtime/wasm-compiler-edge")
const versionedDynamicImportRegex = /e\.y\(["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']\)/g;
if (versionedDynamicImportRegex.test(content)) {
  content = content.replace(
    versionedDynamicImportRegex,
    `e.y("${shimPath}")`
  );
  console.log("Patched versioned dynamic import (e.y)");
  patched = true;
}

// Pattern 2: e.y("@prisma/client/runtime/wasm-compiler-edge")
const standardDynamicImportRegex = /e\.y\(["']@prisma\/client\/runtime\/wasm-compiler-edge["']\)/g;
if (standardDynamicImportRegex.test(content)) {
  content = content.replace(
    standardDynamicImportRegex,
    `e.y("${shimPath}")`
  );
  console.log("Patched standard dynamic import (e.y)");
  patched = true;
}

// Pattern 3: import ... from "@prisma/client-<hash>/runtime/wasm-compiler-edge"
const versionedImportRegex = /from\s+["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']/g;
if (versionedImportRegex.test(content)) {
  content = content.replace(versionedImportRegex, `from "${shimPath}"`);
  console.log("Patched versioned ES module import");
  patched = true;
}

// Pattern 4: import ... from "@prisma/client/runtime/wasm-compiler-edge"
const standardImportRegex = /from\s+["']@prisma\/client\/runtime\/wasm-compiler-edge["']/g;
if (standardImportRegex.test(content)) {
  content = content.replace(standardImportRegex, `from "${shimPath}"`);
  console.log("Patched standard ES module import");
  patched = true;
}

// Pattern 5: require("@prisma/client-<hash>/runtime/wasm-compiler-edge")
const versionedRequireRegex = /require\(["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']\)/g;
if (versionedRequireRegex.test(content)) {
  content = content.replace(versionedRequireRegex, `require("${shimPath}")`);
  console.log("Patched versioned require");
  patched = true;
}

// Pattern 6: require("@prisma/client/runtime/wasm-compiler-edge")
const standardRequireRegex = /require\(["']@prisma\/client\/runtime\/wasm-compiler-edge["']\)/g;
if (standardRequireRegex.test(content)) {
  content = content.replace(standardRequireRegex, `require("${shimPath}")`);
  console.log("Patched standard require");
  patched = true;
}

if (patched) {
  writeFileSync(handlerPath, content);
  console.log("✅ Successfully patched:", handlerPath);
} else {
  console.log("⚠️  No patches needed or patterns not found");
}