import type { Metadata } from "next";

import {
  ContactDetails,
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${siteConfig.name} stores, why it stores it, and who can see it.`,
  alternates: { canonical: "/privacy" },
};

/**
 * The privacy policy describes the software, not a company: this app can be
 * run by anyone, and the operator of a given deployment is the one who answers
 * for the data in it. Every claim below is drawn from the code — the cookie
 * names and lifetimes from `proxy.ts` and `lib/auth/session.ts`, the storage
 * model from `prisma/schema.prisma`, the link lifetimes from `lib/storage/s3.ts`
 * — so it cannot quietly drift into marketing.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      lead={`What ${siteConfig.name} stores, why it stores it, and who is allowed to see it.`}
    >
      <LegalSection id="who-this-is-for" title="Who this policy is for">
        <p>
          {siteConfig.name} is classroom software: classes, classwork,
          submissions, rubrics and grades. This page describes what the software
          itself holds and who can reach it.
        </p>
        <p>
          If you signed in to a copy run by a school, college or training
          provider, that organisation is responsible for the data in it. Their
          own privacy notice — if they publish one — sits on top of this page,
          and questions about your account belong with them first.
        </p>
      </LegalSection>

      <LegalSection id="what-is-stored" title="What is stored">
        <ul>
          <li>
            <strong>Your account.</strong> Name, email address, the photo URL
            your sign-in provider returns, your role (teacher or student) and,
            for administrators, a flag that unlocks the admin console.
          </li>
          <li>
            <strong>Classroom work.</strong> The classes you create or join,
            announcements, comments, attachments, assignments, quizzes,
            questions and material, your submissions, marks, rubric scores and
            the private feedback written on them.
          </li>
          <li>
            <strong>CLA Bridge estimates.</strong> Only if you use the
            estimator: the levels you select and the totals it calculates for
            you.
          </li>
        </ul>
        <p>
          That is the whole list. There is no advertising profile, no analytics
          identifier and no third-party tracking script anywhere in the app.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <p>The app sets two, and neither is used for tracking:</p>
        <ul>
          <li>
            <strong>
              <code>__session</code>
            </strong>{" "}
            keeps you signed in. It is httpOnly, SameSite=Lax, marked Secure in
            production, and lasts 14 days. Signing out deletes it.
          </li>
          <li>
            <strong>
              <code>__landing_checked</code>
            </strong>{" "}
            lives for a few seconds. It is set only after the landing page has
            looked at a session cookie, and its one job is to stop a redirect
            loop when that session turns out to have expired.
          </li>
        </ul>
        <p>
          No analytics, advertising or preference cookies are set — by us or by
          anyone else.
        </p>
      </LegalSection>

      <LegalSection id="who-can-see" title="Who can see your work">
        <p>
          A class is visible to the teacher who created it and to the students
          enrolled in it. Students see their own submissions, marks and
          feedback; they do not see another student&apos;s. Administrators can
          open any class on the deployment, which is what lets them support it.
        </p>
        <p>
          Files are never public. An upload is stored in a private bucket and
          served through a link the server signs after checking that you belong
          to the class — those links expire after an hour, and the check runs
          again on every request.
        </p>
      </LegalSection>

      <LegalSection id="where-it-runs" title="Where it runs">
        <p>
          A deployment of {siteConfig.name} uses these services to do its work:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> serves the site and runs the server code.
          </li>
          <li>
            <strong>Neon</strong> holds the database and the uploaded files, in
            the us-east-1 region.
          </li>
          <li>
            <strong>Firebase Authentication</strong> verifies sign-in
            credentials — with an email and password, or with Google.
          </li>
          <li>
            <strong>Pusher</strong> delivers live updates such as a new comment
            or a returned grade.
          </li>
        </ul>
        <p>
          Each of them processes data on the operator&apos;s instructions. None
          of them receives it to sell, and none is given it for advertising.
        </p>
      </LegalSection>

      <LegalSection id="how-long" title="How long it is kept">
        <p>
          Work is kept for as long as the class it belongs to exists. Deleting a
          class removes its classwork and submissions with it; an account stays
          until it is removed. Nothing expires on a timer, and nothing is kept
          in a separate archive.
        </p>
        <p>
          To have an account or a class deleted, write to the operator of your
          deployment.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title="Your rights">
        <p>
          You can ask for a copy of your data, ask for it to be corrected, ask
          for it to be deleted, or object to a particular use of it. Teachers
          and administrators can export the gradebook as a CSV file from inside
          the app at any time.
        </p>
        <p>
          If you are a student, the school that enrolled you may need to make
          that request on your behalf — ask them first, since they hold the
          record. You also have the right to complain to a data protection
          authority in your country.
        </p>
      </LegalSection>

      <LegalSection id="students" title="Students">
        <p>
          {siteConfig.name} is built for schools, colleges and training teams,
          so many of the people using it are students. There is no advertising
          in the product, no profiling of students, and no data sold to anyone.
          Joining a class takes a code that a teacher hands out, and nothing
          more.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          When the text changes, the date at the top of the page changes with
          it. If a change affects what is stored or who can see it, it is worth
          reading this page again.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <ContactDetails />
      </LegalSection>
    </LegalPage>
  );
}
