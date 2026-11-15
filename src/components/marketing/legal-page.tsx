import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { policiesUpdated } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

/**
 * The shell the three policy pages share.
 *
 * They are static documents with one column of prose, so the layout is fixed
 * here instead of repeated three times: header, a title block on the card
 * surface, the text at a readable measure, then the footer.
 */
export function LegalPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main id="main" className="flex-1">
        <div className="border-b border-border bg-card">
          <div className="container-page py-12 sm:py-16">
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
              <Link
                href="/"
                className="rounded-sm transition-colors hover:text-foreground"
              >
                Home
              </Link>
              <span aria-hidden className="px-2">
                /
              </span>
              <span aria-current="page" className="text-foreground">
                {title}
              </span>
            </nav>

            <h1 className="mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
              {lead}
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
              Last updated{" "}
              <time dateTime={policiesUpdated.iso}>{policiesUpdated.label}</time>
            </p>
          </div>
        </div>

        <div className="container-page py-12 sm:py-16">
          <div className="max-w-[35rem] space-y-10">{children}</div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** One numbered part of a policy. The heading id is the anchor for the section. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="policy-prose mt-3">{children}</div>
    </section>
  );
}

/**
 * Where to write.
 *
 * The address comes from `NEXT_PUBLIC_CONTACT_EMAIL` because it belongs to
 * whoever operates the deployment, not to the software. Without it the pages
 * say so plainly instead of publishing an address nobody reads.
 */
export function ContactDetails() {
  const email = siteConfig.contactEmail;

  if (!email) {
    return (
      <p>
        This deployment does not publish a contact address. If you reached it
        through a school, college or training provider, ask their administrator
        — they run this copy of {siteConfig.name} and can answer for it.
      </p>
    );
  }

  return (
    <p>
      Write to <a href={`mailto:${email}`}>{email}</a>.
    </p>
  );
}
