/** Single source of truth for branding and SEO copy. */
export const siteConfig = {
  name: "LMS Core",
  tagline: "A calm classroom for teachers and students",
  description:
    "LMS Core is a calm classroom for schools, colleges and training teams. Create classes, share classwork, collect submissions and grade them against a rubric.",
  url: siteUrl(),
} as const;

/**
 * The public address of the site.
 *
 * `NEXT_PUBLIC_SITE_URL` is the source of truth. On Vercel the production
 * project host is the fallback, so a build that has not been given the
 * variable still publishes real canonical links, a real sitemap and real
 * social cards instead of localhost. Local development falls back to localhost
 * on purpose.
 */
function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (host) return `https://${host}`;

  return "http://localhost:3000";
}
