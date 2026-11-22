import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Cloudflare Workers build of LMS Core.
 *
 * Vercel keeps using `next build` unchanged; `opennextjs-cloudflare build`
 * wraps that same output for workerd. Nothing here is Vercel-specific, and
 * nothing in the Next.js app imports this file.
 *
 * The app is dynamic (every authenticated page is force-dynamic), so no
 * incremental cache is configured. Add `r2IncrementalCache` here and an
 * `NEXT_INC_CACHE_R2_BUCKET` binding in `wrangler.jsonc` if static or ISR
 * routes are introduced later.
 *
 * The workerd Prisma client (runtime = "workerd") uses static WASM imports
 * instead of `new WebAssembly.Module(base64)` at runtime. We alias
 * `@prisma/client` to the workerd-specific generated client during the
 * OpenNext bundling step.
 */
export default defineCloudflareConfig({
  // @ts-ignore - webpack property not in types but works at runtime
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@prisma/client": "./src/generated/prisma-workerd/client",
      // The workerd client imports @prisma/client/runtime/wasm-compiler-edge
      // which uses new WebAssembly.Module() - forbidden on workerd.
      // Replace it with a workerd-compatible shim that uses static WASM imports.
      "@prisma/client/runtime/wasm-compiler-edge": "./src/lib/prisma-workerd-runtime",
      // Some bundled modules reference a versioned path
      "@prisma/client-2c3a283f134fdcb6/runtime/wasm-compiler-edge": "./src/lib/prisma-workerd-runtime",
    };
    // Also handle versioned internal paths via regex
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@prisma/client/runtime/wasm-compiler-edge": "./src/lib/prisma-workerd-runtime",
    };
    return config;
  },
  // @ts-ignore - esbuild options for OpenNext bundling step
  esbuildOptions: {
    plugins: [
      {
        name: "prisma-runtime-alias",
        setup(build: { onResolve: (arg0: { filter: RegExp }, arg1: () => { path: string; external: boolean; }) => void; onLoad: (arg0: { filter: RegExp }, arg1: (arg0: { contents: string }) => { contents: string }) => void }) {
          // Alias versioned Prisma runtime imports to our shim (static imports)
          build.onResolve({ filter: /@prisma\/client-.*\/runtime\/wasm-compiler-edge/ }, () => ({
            path: "./src/lib/prisma-workerd-runtime",
            external: false,
          }));
          build.onResolve({ filter: /@prisma\/client\/runtime\/wasm-compiler-edge/ }, () => ({
            path: "./src/lib/prisma-workerd-runtime",
            external: false,
          }));

          // Also rewrite dynamic imports (e.y("...")) in loaded source files
          build.onLoad({ filter: /.*/ }, (args) => {
            let contents = args.contents;
            // Replace versioned dynamic import: e.y("@prisma/client-<hash>/runtime/wasm-compiler-edge")
            contents = contents.replace(
              /e\.y\(["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']\)/g,
              'e.y("./src/lib/prisma-workerd-runtime")'
            );
            // Replace standard dynamic import: e.y("@prisma/client/runtime/wasm-compiler-edge")
            contents = contents.replace(
              /e\.y\(["']@prisma\/client\/runtime\/wasm-compiler-edge["']\)/g,
              'e.y("./src/lib/prisma-workerd-runtime")'
            );
            // Replace versioned ES module imports
            contents = contents.replace(
              /from\s+["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']/g,
              'from "./src/lib/prisma-workerd-runtime"'
            );
            // Replace standard ES module imports
            contents = contents.replace(
              /from\s+["']@prisma\/client\/runtime\/wasm-compiler-edge["']/g,
              'from "./src/lib/prisma-workerd-runtime"'
            );
            // Replace versioned require() calls
            contents = contents.replace(
              /require\(["']@prisma\/client-[a-f0-9]+\/runtime\/wasm-compiler-edge["']\)/g,
              'require("./src/lib/prisma-workerd-runtime")'
            );
            // Replace standard require() calls
            contents = contents.replace(
              /require\(["']@prisma\/client\/runtime\/wasm-compiler-edge["']\)/g,
              'require("./src/lib/prisma-workerd-runtime")'
            );
            return { contents };
          });
        },
      },
    ],
  },
});