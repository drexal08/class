import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Feather,
  GraduationCap,
  LayoutGrid,
  Lock,
  MessagesSquare,
  ShieldCheck,
  Users,
} from "lucide-react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  featureHighlights,
  principles,
  studentWorkflow,
  teacherWorkflow,
} from "@/lib/landing-copy";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

/**
 * The landing page is a static document.
 *
 * It used to ask the database who the visitor was so it could redirect signed-in
 * users to their dashboard. That turned every anonymous visit into a live query
 * against a database that scales to zero. The redirect now happens in
 * `proxy.ts`, which only looks for the session cookie, so this page is
 * prerendered at build time and served straight from the CDN.
 */

const FEATURE_ICONS = {
  grid: LayoutGrid,
  messages: MessagesSquare,
  work: ClipboardList,
  marking: GraduationCap,
  grades: ShieldCheck,
  timeline: CalendarDays,
} as const;

const PRINCIPLE_ICONS = {
  feather: Feather,
  shield: ShieldCheck,
  lock: Lock,
} as const;

export default function LandingPage() {
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

      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />

        <main id="main" className="flex-1">
          {/* ---------------------------------------------------------------
              Hero
          ---------------------------------------------------------------- */}
          <section className="relative overflow-hidden border-b border-border">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 hero-glow"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] hero-grid hero-mask"
            />

            <div className="container-page relative py-16 sm:py-20 lg:py-28">
              <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
                <div className="max-w-2xl">
                  <p className="inline-flex items-start gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-sm font-medium text-foreground backdrop-blur">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    For schools, colleges and training teams
                  </p>

                  <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-5xl lg:text-[3.5rem]">
                    {siteConfig.tagline}
                  </h1>

                  <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
                    Create classes, share work, collect submissions and grade them
                    against a rubric — without the noise. Built so the interface
                    gets out of the way of the teaching.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button asChild size="lg">
                      <Link href="/register">
                        Create your account
                        <ArrowRight />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                      <Link href="/login">Sign in</Link>
                    </Button>
                  </div>

                  <p className="mt-6 text-sm text-muted-foreground">
                    Free to use · Students join with a seven-character code ·
                    No invitation list to chase
                  </p>
                </div>

                <ProductPreview />
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------
              Principles
          ---------------------------------------------------------------- */}
          <section
            aria-labelledby="principles-heading"
            className="border-b border-border bg-card"
          >
            <div className="container-page py-12 sm:py-14">
              <h2 id="principles-heading" className="sr-only">
                How the classroom is built
              </h2>
              <ul className="grid gap-8 sm:grid-cols-3 sm:gap-10">
                {principles.map((principle) => {
                  const Icon = PRINCIPLE_ICONS[principle.icon];
                  return (
                    <li key={principle.title}>
                      <Icon
                        className="size-5 text-muted-foreground"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <h3 className="mt-3 text-base font-semibold tracking-tight">
                        {principle.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {principle.description}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* ---------------------------------------------------------------
              Features
          ---------------------------------------------------------------- */}
          <section
            id="features"
            aria-labelledby="features-heading"
            className="scroll-mt-20 border-b border-border"
          >
            <div className="container-page py-16 sm:py-20 lg:py-24">
              <div className="max-w-2xl">
                <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Features
                </p>
                <h2
                  id="features-heading"
                  className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
                >
                  Classwork, conversations and grades
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
                  The parts of classwork teachers use, without the rest getting
                  in the way.
                </p>
              </div>

              <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featureHighlights.map((feature) => {
                  const Icon = FEATURE_ICONS[feature.icon];
                  return (
                    <li key={feature.title}>
                      <Card className="h-full p-6">
                        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                          <Icon
                            className="size-5"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </span>
                        <h3 className="mt-4 text-base font-semibold tracking-tight">
                          {feature.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {feature.description}
                        </p>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* ---------------------------------------------------------------
              How it works
          ---------------------------------------------------------------- */}
          <section
            id="how-it-works"
            aria-labelledby="how-it-works-heading"
            className="scroll-mt-20 border-b border-border bg-card"
          >
            <div className="container-page py-16 sm:py-20 lg:py-24">
              <div className="max-w-2xl">
                <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  How it works
                </p>
                <h2
                  id="how-it-works-heading"
                  className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
                >
                  Three steps, from either side
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
                  Teachers set the work and mark it. Students join, hand it in and
                  read the feedback. Nothing else needs to happen.
                </p>
              </div>

              <div className="mt-12 grid gap-5 lg:grid-cols-2">
                <WorkflowCard
                  id="teachers"
                  icon={GraduationCap}
                  title="For teachers"
                  steps={teacherWorkflow}
                />
                <WorkflowCard
                  id="students"
                  icon={Users}
                  title="For students"
                  steps={studentWorkflow}
                />
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------
              Closing call to action
          ---------------------------------------------------------------- */}
          <section className="bg-primary text-primary-foreground">
            <div className="container-page py-16 sm:py-20">
              <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary-foreground/70">
                    Ready when you are
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                    Set up your first class and share the code.
                  </h2>
                  <p className="mt-4 text-lg leading-relaxed text-primary-foreground/75 text-pretty">
                    Create the class, share the code, and start posting work.
                    Students can join straight away.
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                  >
                    <Link href="/register">
                      Create an account
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------
   Sections
   ------------------------------------------------------------------------- */

function WorkflowCard({
  id,
  icon: Icon,
  title,
  steps,
}: {
  id: string;
  icon: typeof Users;
  title: string;
  steps: readonly { title: string; description: string }[];
}) {
  return (
    <Card
      id={id}
      className="scroll-mt-24 p-6 sm:p-8"
      aria-labelledby={`${id}-heading`}
    >
      <span className="inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <h3
        id={`${id}-heading`}
        className="mt-4 text-xl font-semibold tracking-tight"
      >
        {title}
      </h3>

      <ol className="mt-6 space-y-6">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground"
              aria-hidden
            >
              {index + 1}
            </span>
            <div>
              <h4 className="text-sm font-semibold">{step.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* -------------------------------------------------------------------------
   The product preview in the hero
   ------------------------------------------------------------------------- */

/**
 * A picture of the app, drawn with markup.
 *
 * There is no screenshot and no image request: the preview is plain HTML and
 * the tokens the rest of the app uses, so it costs nothing to load and it
 * stays in step with the real interface.
 *
 * It is an illustration, not a record of anyone's classroom, so it is read out
 * as one object with a single description instead of a pile of invented
 * announcements, marks and names.
 */
function ProductPreview() {
  return (
    <div
      className="relative mx-auto w-full max-w-xl lg:max-w-none"
      role="img"
      aria-label="An example classroom: an announcement about a lab report due on Friday, a rubric with four of four criteria met, and a list of work to hand in."
    >
      <div
        className="overflow-hidden rounded-xl border border-border bg-card shadow-float"
        aria-hidden
      >
        <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-4 py-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </span>
          <p className="truncate text-xs font-medium text-muted-foreground">
            Example classroom · Biology 101
          </p>
        </div>

        <div className="grid sm:grid-cols-[1.4fr_1fr]">
          <div className="border-b border-border p-5 sm:border-b-0 sm:border-r">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                A
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">
                  Ms. Achieng
                </p>
                <p className="text-xs text-muted-foreground">Pinned · 9:12</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Cell division is on Friday. Bring one labelled diagram per team —
              we mark them against the rubric in class.
            </p>

            <div className="mt-5 rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Lab report · mitosis</p>
                <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Due Friday
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div className="h-full w-2/3 rounded-full bg-primary/70" />
              </div>
            </div>
          </div>

          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              To hand in
            </p>
            <ul className="mt-4 space-y-4">
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                <div>
                  <p className="text-sm font-medium leading-snug">Lab report</p>
                  <p className="text-xs text-muted-foreground">Due Friday</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" />
                <div>
                  <p className="text-sm font-medium leading-snug">
                    Quiz 3 · cell structure
                  </p>
                  <p className="text-xs text-muted-foreground">Returned · 92%</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border" />
                <div>
                  <p className="text-sm font-medium leading-snug">
                    Photosynthesis diagram
                  </p>
                  <p className="text-xs text-muted-foreground">Not started</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        className="absolute -top-5 -right-4 hidden w-56 rounded-lg border border-border bg-card p-4 shadow-float sm:block lg:-right-6"
        aria-hidden
      >
        <p className="text-xs text-muted-foreground">Rubric grading</p>
        <p className="mt-1 text-sm font-semibold">4 of 4 criteria met</p>
      </div>
    </div>
  );
}
