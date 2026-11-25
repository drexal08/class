// Type declarations for Prisma workerd WASM modules
declare module "../generated/prisma-workerd/internal/query_compiler_fast_bg.js" {
  const mod: any;
  export default mod;
}

declare module "../generated/prisma-workerd/internal/query_compiler_fast_bg.wasm?module" {
  const mod: { default: WebAssembly.Module };
  export default mod;
}