import type { Metadata } from "next";

import {
  ContactDetails,
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: `The rules for using ${siteConfig.name}: your account, acceptable use, the work you post and how marks are treated.`,
  alternates: { canonical: "/terms" },
};

/**
 * Plain-language terms.
 *
 * They say what the software does and what the operator does not promise. The
 * wording is deliberately narrow — no unlimited liability disclaimers dressed
 * up as reassurance, and no promise of uptime or backups the app does not make.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      lead={`The rules for using ${siteConfig.name} — for the teacher setting work and the student handing it in.`}
    >
      <LegalSection id="using-the-service" title="Using the service">
        <p>
          By creating an account, or by joining a class with a code, you agree
          to these terms. If you are not old enough to agree on your own behalf,
          the school, college or guardian who enrolled you accepts them for you.
        </p>
        <p>
          If you are using a deployment run by an organisation, their own rules
          apply as well, and where the two disagree, theirs take precedence for
          their deployment.
        </p>
      </LegalSection>

      <LegalSection id="your-account" title="Your account">
        <p>
          Give accurate details, keep your password to yourself, and do not pass
          your account to anyone else. If you think someone has got into it,
          change the password and tell an administrator.
        </p>
        <p>
          Teachers and administrators can change a role or remove someone from a
          class. Administrators can suspend an account entirely. Roles are never
          something you can assign yourself.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="Acceptable use">
        <p>Do not use the service to:</p>
        <ul>
          <li>harass, threaten or impersonate anyone;</li>
          <li>
            upload material you have no right to share, or anything malicious;
          </li>
          <li>
            try to reach a class, a submission or an account you are not a
            member of;
          </li>
          <li>
            probe, scan or overload the service, or download its contents in
            bulk with a script;
          </li>
          <li>break the law, or help someone else to.</li>
        </ul>
        <p>
          Material that breaks these rules can be removed, and the account that
          posted it can lose access.
        </p>
      </LegalSection>

      <LegalSection id="work-you-post" title="The work you post">
        <p>
          What you write and upload stays yours. By posting it, you give the
          operator permission to store it, copy it and show it to the people the
          class is shared with — which is what the product is for, and nothing
          wider.
        </p>
        <p>
          If you are a teacher, you confirm you have the right to hand out the
          material you upload. Do not post a textbook chapter, a past paper or
          someone else&apos;s worksheet unless you are licensed to.
        </p>
      </LegalSection>

      <LegalSection id="marks" title="Marks and records">
        <p>
          The gradebook records the marks and feedback that staff enter. It is a
          teaching tool, not an official transcript, and it does not decide
          anything: assessment decisions belong to the school.
        </p>
        <p>
          Teachers and administrators can export the gradebook as a CSV file.
          Keep your own copy of anything you would be sorry to lose.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="Availability and changes">
        <p>
          The service is provided as it is. Features can change, and the
          software is updated as it improves. No uptime, response time or backup
          is promised here unless a separate written agreement says otherwise.
        </p>
      </LegalSection>

      <LegalSection id="ending-access" title="Ending access">
        <p>
          You can stop using the service at any time and ask for your account to
          be removed. An account that breaks these terms can be suspended, and a
          deployment can be closed down by whoever operates it.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="Liability">
        <p>
          To the extent the law allows, the operator is not liable for indirect
          or consequential loss, for lost marks or assessment outcomes, or for
          data lost through misuse of an account. Nothing here limits a right
          you have under the law that applies to you, including consumer rights
          where they apply.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to these terms">
        <p>
          When the wording changes, the date at the top of the page changes with
          it. Continuing to use the service after a change means the new terms
          apply.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <ContactDetails />
      </LegalSection>
    </LegalPage>
  );
}
