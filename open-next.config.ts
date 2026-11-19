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
 */
export default defineCloudflareConfig({});
