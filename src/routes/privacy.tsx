import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/synclab/contact";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — SYNCLAB" },
      {
        name: "description",
        content: "How SYNCLAB collects, uses, shares and protects your personal data.",
      },
      { property: "og:title", content: "Privacy Notice — SYNCLAB" },
      { property: "og:description", content: "How SYNCLAB handles your personal data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyRoute,
});

function PrivacyRoute() {
  return (
    <LegalPage title="Privacy Notice" updated="22 November 2026">
      <p>
        SYNCLAB is based in Detroit, Michigan, USA. We are the <strong>data controller</strong> for
        the personal data described here, which means we decide why and how it is used. Contact:{" "}
        <strong>{SUPPORT_EMAIL}</strong>.
      </p>

      <h2>What we collect and why</h2>
      <ul>
        <li>
          <strong>Account data</strong> (email address, password credentials, sign-in provider ID) —
          to create and secure your account. Legal basis: performance of our contract with you.
        </li>
        <li>
          <strong>Project content</strong> (projects, audio recordings, MIDI, samples, track notes
          you choose to save to the cloud) — to provide cloud saving and let you reopen your work.
          Legal basis: contract.
        </li>
        <li>
          <strong>Subscription status</strong> (plan, status, renewal dates, payment provider
          customer and subscription identifiers received from Paddle) — to unlock the features you
          paid for. Legal basis: contract. Card details never reach us; Paddle handles payment data.
        </li>
        <li>
          <strong>Support messages</strong> you send us — to answer you. Legal basis: legitimate
          interest in supporting customers.
        </li>
        <li>
          <strong>Technical and usage data</strong> (IP address, device and browser type, error
          reports, feature usage) — for security, fraud prevention, debugging and product
          improvement. Legal basis: legitimate interests.
        </li>
        <li>
          <strong>Sign-in history</strong> (your name and email, the time, your approximate location
          — city, region and country worked out from your internet connection — and your device and
          browser type) each time you sign in or return to the app — for account security and to
          understand how SYNCLAB is used. Legal basis: legitimate interests.
        </li>
        <li>
          <strong>Marketing emails</strong> — only if you tick “Email me SYNCLAB tips, tutorials and
          offers” or turn it on in Settings → Account. We then share your name, email and plan
          status with our email provider, Loops, to send them. Legal basis: consent, withdrawable at
          any time with the unsubscribe link in any email or in Settings.
        </li>
      </ul>
      <p>
        Microphone and MIDI input are used only in your browser to record and play music. Audio is
        not sent to us unless you save or upload a project.
      </p>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          <strong>Service providers / subprocessors</strong>: hosting, database, authentication and
          storage providers, and error-monitoring tools.
        </li>
        <li>
          <strong>Paddle.com</strong>, our Merchant of Record, for the sale of the product,
          subscription management, payments, tax compliance and invoicing.
        </li>
        <li>
          <strong>Loops</strong>, our email provider, for tips and offers emails — only for people
          who said yes to them.
        </li>
        <li>
          <strong>Professional advisers</strong> (legal, accounting) where necessary.
        </li>
        <li>
          <strong>Authorities</strong> where required by law.
        </li>
      </ul>
      <p>We do not sell your personal data.</p>

      <h2>International transfers</h2>
      <p>
        Our providers may process data in the United States and other countries. Where data is
        transferred out of the UK or EEA, we rely on adequacy decisions or Standard Contractual
        Clauses as appropriate safeguards.
      </p>

      <h2>Retention</h2>
      <p>
        Account and project data is kept while your account is active and for up to 12 months after
        you close it, so you can recover work; billing records are kept as long as tax law requires
        (typically 7 years). Technical logs are kept for up to 12 months. After that, data is
        deleted or anonymised.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may request access to your data, correction, deletion,
        restriction, portability, or object to processing based on legitimate interests, and
        withdraw consent at any time. Email <strong>{SUPPORT_EMAIL}</strong> and we will respond
        within one month. UK/EEA users also have the right to complain to their local data
        protection authority.
      </p>

      <h2>Security</h2>
      <p>
        We use appropriate technical and organisational measures, including encryption in transit,
        access controls and row-level database security, so each account can only reach its own
        data. No system is perfectly secure, so please use a strong, unique password.
      </p>

      <h2>Cookies</h2>
      <p>
        We use <strong>essential</strong> cookies and local storage to keep you signed in, remember
        your studio settings and your saved microphone and MIDI devices, and to run checkout. We do
        not use advertising cookies. You can clear or block cookies in your browser settings, but
        sign-in and saving will stop working.
      </p>

      <h2>Children</h2>
      <p>
        SYNCLAB is not intended for children under 13, and we do not knowingly collect their data.
      </p>

      <h2>Changes</h2>
      <p>We may update this notice; material changes will be announced in the app.</p>
    </LegalPage>
  );
}
