import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * The `Host` directive takes a bare hostname — not a URL.
 *
 * Next writes the value through verbatim, so passing `siteConfig.url` here
 * would emit `Host: https://example.com`, which crawlers reject as malformed
 * and Lighthouse reports as an invalid robots.txt. Strip the scheme and path
 * and keep only the authority.
 */
const siteHost = new URL(siteConfig.url).host;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Everything behind sign-in is private by definition — student work and
        // grades must never be crawled.
        disallow: [
          "/api/",
          "/dashboard",
          "/course/",
          "/admin",
          "/todo",
          "/calendar",
          "/archived",
          "/settings",
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteHost,
  };
}
