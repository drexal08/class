import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * Only public marketing and entry routes are listed. Class pages are private
 * and are excluded from both the sitemap and robots.txt.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: siteConfig.url,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/login`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/register`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
