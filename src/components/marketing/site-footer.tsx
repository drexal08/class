import Link from "next/link";

import { LogoLockup } from "@/components/brand/logo";
import { footerLinks } from "@/lib/landing-copy";
import { siteConfig } from "@/lib/site";

/**
 * The copyright year is read once, at build time.
 *
 * The public pages are static documents, so the year they show is the year
 * they were built in — and every deploy rebuilds them. Reading the clock
 * inside the component would make the render impure for no gain.
 */
const COPYRIGHT_YEAR = new Date().getFullYear();

/**
 * The footer the public pages share.
 *
 * Every link here points at a route that exists: the landing page sections,
 * the two entry routes, and the three published policies.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container-page py-14">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="sm:col-span-2 md:col-span-1">
            <LogoLockup />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Classes, classwork, rubrics and grading in one focused place —
              built for schools, colleges and training teams.
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.heading}>
              <h2 className="text-sm font-semibold">{group.heading}</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {COPYRIGHT_YEAR} {siteConfig.name}
          </p>
          <p>Built for the people who make classrooms work.</p>
        </div>
      </div>
    </footer>
  );
}
