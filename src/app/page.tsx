import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutGrid,
  MessagesSquare,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { featureHighlights, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

const ICONS = [
  LayoutGrid,
  MessagesSquare,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  CalendarDays,
];

export default async function LandingPage() {
  // Signed-in users have no reason to see marketing copy.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  // Structured data so search engines can describe the product correctly.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    description: siteConfig.description,
    url: siteConfig.url,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: featureHighlights.map((feature) => feature.title),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="flex min-h-screen flex-col">
        <header className="border-b border-border bg-card">
          <div className="container-page flex h-16 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                L
              </span>
              <span className="text-base font-semibold">{siteConfig.name}</span>
            </div>
            <nav className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </nav>
          </div>
        </header>

        <main id="main" className="flex-1">
          <section className="border-b border-border bg-card">
            <div className="container-page py-20 md:py-28">
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-muted-foreground">
                  For schools, colleges and training teams
                </p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance md:text-5xl">
                  {siteConfig.tagline}
                </h1>
                <p className="mt-5 text-lg leading-relaxed text-muted-foreground text-pretty">
                  Create classes, share work, collect submissions and grade them
                  against a rubric — without the noise. Built so the interface
                  gets out of the way of the teaching.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg">
                    <Link href="/register">
                      Create your first class
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/login">I already have an account</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="container-page py-16 md:py-24">
            <h2 className="text-2xl font-semibold tracking-tight">
              Everything a class needs
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              The features teachers actually reach for, without the ones that get
              in the way.
            </p>

            <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {featureHighlights.map((feature, index) => {
                const Icon = ICONS[index % ICONS.length];
                return (
                  <li key={feature.title}>
                    <Icon
                      className="size-5 text-muted-foreground"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <h3 className="mt-3 font-medium">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>

        <footer className="border-t border-border bg-card">
          <div className="container-page flex flex-col gap-2 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              {siteConfig.name} — {siteConfig.tagline}.
            </p>
            <p>Built with Next.js, Prisma and PostgreSQL.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
