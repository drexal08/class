#!/usr/bin/env node
/**
 * Patch the final bundled files after OpenNext's bundling step.
 * This catches the versioned Prisma runtime imports that are introduced
 * during OpenNext's esbuild bundling step.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const filesToPatch = [
  resolve(".open-next/worker.js"),
  resolve(".open-next/server-functions/default/handler.mjs"),
];

const shimPath = "./src/lib/prisma-workerd-runtime";

function patchFile(filePath) {
  if (!existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = readFileSync(filePath, "utf8");
  let patched = false;

  // Replace versioned dynamic imports (e.y() calls from esbuild)
  const versionedDynamicImportRegex = /e\.y\(["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']\)/g;
  if (versionedDynamicImportRegex.test(content)) {
    content = content.replace(versionedDynamicImportRegex, `e.y("./src/lib/prisma-workerd-runtime")`);
    console.log(`Patched versioned dynamic import in ${filePath}`);
    patched = true;
  }

  // Replace standard dynamic imports
  const standardDynamicImportRegex = /e\.y\(["']@prisma\/client\/runtime\/wasm-compiler-edge["']\)/g;
  if (standardDynamicImportRegex.test(content)) {
    content = content.replace(standardDynamicImportRegex, `e.y("./src/lib/prisma-workerd-runtime")`);
    console.log(`Patched standard dynamic import in ${filePath}`);
    patched = true;
  }

  // Replace versioned ES module imports
  const versionedImportRegex = /from\s+["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']/g;
  if (versionedImportRegex.test(content)) {
    content = content.replace(versionedImportRegex, `from "./src/lib/prisma-workerd-runtime"`);
    console.log(`Patched versioned import in ${filePath}`);
    patched = true;
  }

  // Replace standard ES module imports
  const standardImportRegex = /from\s+["']@prisma\/client\/runtime\/wasm-compiler-edge["']/g;
  if (standardImportRegex.test(content)) {
    content = content.replace(standardImportRegex, `from "./src/lib/prisma-workerd-runtime"`);
    console.log(`Patched standard import in ${filePath}`);
    patched = true;
  }

  // Replace versioned require() calls
  const versionedRequireRegex = /require\(["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']\)/g;
  if (versionedRequireRegex.test(content)) {
    content = content.replace(versionedRequireRegex, `require("./src/lib/prisma-workerd-runtime")`);
    console.log(`Patched versioned require in ${filePath}`);
    patched = true;
  }

  // Replace standard require() calls
  const standardRequireRegex = /require\(["']@prisma\/client\/runtime\/wasm-compiler-edge["']\)/g;
  if (standardRequireRegex.test(content)) {
    content = content.replace(standardRequireRegex, `require("./src/lib/prisma-workerd-runtime")`);
    console.log(`Patched standard require in ${filePath}`);
    patched = true;
  }

  if (patched) {
    writeFileSync(filePath, content);
    console.log(`✅ Successfully patched: ${filePath}`);
  }

  return patched;
}

console.log("Patching final bundled files...");

let anyPatched = false;
for (const filePath of filesToPatch) {
  if (patchFile(filePath)) {
    anyPatched = true;
  }
}

if (anyPatched) {
  console.log("Done patching final bundled files");
} else {
  console.log("No patches needed");
}