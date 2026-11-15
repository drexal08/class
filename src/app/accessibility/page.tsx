import type { Metadata } from "next";

import {
  ContactDetails,
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Accessibility",
  description: `How ${siteConfig.name} is built for keyboard and screen reader users, what it does not yet do, and how to report a barrier.`,
  alternates: { canonical: "/accessibility" },
};

/**
 * An accessibility statement that says what has actually been done.
 *
 * It names what is implemented (all of it visible in the components and the
 * tokens), what has not been done (no formal audit, no dark theme, no claims
 * about uploaded documents) and how to report a barrier. It deliberately does
 * not print "WCAG 2.2 AA compliant", because nothing here has been audited
 * against it.
 */
export default function AccessibilityPage() {
  return (
    <LegalPage
      title="Accessibility"
      lead="What works today, what is missing, and how to tell us about a barrier."
    >
      <LegalSection id="target" title="What we aim for">
        <p>
          {siteConfig.name} targets WCAG 2.2 level AA. A classroom is used by
          everyone, and a platform that only works with a mouse and a sharp eye
          excludes people by accident.
        </p>
        <p>
          The sections below describe what has been built and checked. They are
          not a conformance claim: no independent audit has been carried out
          yet, so we would rather state the detail than print a badge.
        </p>
      </LegalSection>

      <LegalSection id="what-is-in-place" title="What is in place">
        <ul>
          <li>
            <strong>Structure.</strong> Every page has one main landmark and one
            first-level heading. The first thing a keyboard reaches is a skip
            link that jumps past the header to the content.
          </li>
          <li>
            <strong>Focus.</strong> Anything you can operate shows a two-pixel
            outline with a two-pixel offset when it has focus, drawn the same way
            everywhere rather than being switched off for aesthetics.
          </li>
          <li>
            <strong>Components.</strong> Menus, dialogs, tabs, selects and
            tooltips are built on Radix primitives, which handle arrow keys,
            Escape, focus trapping and returning focus where it came from.
          </li>
          <li>
            <strong>Forms.</strong> Fields have a label bound to the input, and
            an error is written next to the field it belongs to instead of in a
            summary at the top of the page.
          </li>
          <li>
            <strong>Motion.</strong> When your system asks for reduced motion,
            animation and transitions drop to nothing.
          </li>
          <li>
            <strong>Text.</strong> The typeface is Inter and sizes are set in
            rem, so browser zoom and a larger default text size both work. The
            layout is fluid down to 320 pixels wide.
          </li>
          <li>
            <strong>Colour.</strong> Body copy is muted grey on the page canvas
            at 4.55:1, and on cards at 4.76:1 — both above the 4.5:1 target for
            normal text.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="known-limitations" title="What is not done yet">
        <ul>
          <li>
            <strong>No formal audit.</strong> There is no independent
            assessment and no published conformance report. Where this page
            says something works, it means it has been built and spot-checked,
            not certified.
          </li>
          <li>
            <strong>No dark theme.</strong> The interface is light only. Nothing
            claims otherwise, and no half-finished theme is offered.
          </li>
          <li>
            <strong>Uploaded documents.</strong> A PDF or an image a teacher
            attaches is shown through a signed link. Whether it reads well with
            a screen reader depends on the file and on how it was made, which is
            outside our control.
          </li>
          <li>
            <strong>Live updates.</strong> Some changes — a new comment, a
            returned grade — arrive without a page reload. If one happens while
            you are reading elsewhere on the page, it may pass without
            announcing itself.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="reporting" title="Reporting a barrier">
        <p>
          If something gets in your way, tell us which page you were on, what you
          tried to do, and what happened instead. A screenshot helps; so does
          knowing whether you were using a keyboard, a screen reader or zoom.
        </p>
        <ContactDetails />
        <p>
          We will look at it, tell you what we found, and say whether and when
          it will be fixed.
        </p>
      </LegalSection>

      <LegalSection id="how-it-is-checked" title="How the pages are checked">
        <p>
          The public pages run through Lighthouse&apos;s accessibility audit
          before a release, which covers contrast, labels, landmarks, heading
          order and the accessible names of controls; the landing page currently
          scores 100. Automated rules catch a fraction of real barriers, so they
          are a floor rather than a certificate — which is why the list above
          says what has not been tested.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
