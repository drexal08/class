import Link from "next/link";

import { LogoLockup } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { landingNav } from "@/lib/landing-copy";
import { siteConfig } from "@/lib/site";

/**
 * The header the public pages share.
 *
 * It lives here rather than inside the landing page because the policy pages
 * carry it too. The section links point at `/#…` instead of `#…` so the same
 * markup works from any page: on the landing page the browser scrolls,
 * everywhere else Next navigates home first.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container-page flex h-16 items-center gap-3 sm:gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-md"
          aria-label={siteConfig.name}
        >
          <LogoLockup nameClassName="hidden sm:inline" />
        </Link>

        <nav
          aria-label="Sections"
          className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"
        >
          {landingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
