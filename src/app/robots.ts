import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

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
    host: siteConfig.url,
  };
}
