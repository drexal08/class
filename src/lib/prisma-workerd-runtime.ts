/**
 * Workerd-compatible Prisma runtime shim.
 *
 * The Prisma workerd client (runtime = "workerd") imports the edge runtime
 * (`@prisma/client/runtime/wasm-compiler-edge`) which uses `new WebAssembly.Module()`.
 * This shim provides a workerd-compatible replacement by exporting a namespace
 * object that mimics the edge runtime's exports.
 */

import * as workerdPrismaNamespace from "../generated/prisma-workerd/internal/prismaNamespace";
import { getPrismaClientClass } from "../generated/prisma-workerd/internal/class";

// Minimal Debug implementation (no-op)
const Debug = {
  enable: () => {},
  disable: () => {},
  enabled: false,
  log: () => {},
};

// Create a namespace object that mimics the edge runtime
const runtime = {
  ...workerdPrismaNamespace,
  Debug,
  getPrismaClient: getPrismaClientClass,
  getRuntime: async () => {
    // Dynamic import of WASM module - TypeScript doesn't have declarations for this
    const mod: any = await import("../generated/prisma-workerd/internal/query_compiler_fast_bg.js");
    return mod;
  },
  getQueryCompilerWasmModule: async () => {
    // Dynamic import of WASM module - TypeScript doesn't have declarations for this
    const mod: any = await import("../generated/prisma-workerd/internal/query_compiler_fast_bg.wasm?module");
    return mod.default;
  },
  importName: "./query_compiler_fast_bg.js",
};

// Export as default for `import * as runtime from ...`
export default runtime;

// Also export named for compatibility
export { runtime, Debug };
export { getPrismaClientClass as getPrismaClient };
export { getPrismaClientClass };
export * from "../generated/prisma-workerd/internal/prismaNamespace";