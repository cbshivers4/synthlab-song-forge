import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — SYNCLAB" },
      {
        name: "description",
        content:
          "The terms that govern your use of SYNCLAB, the browser-based Detroit music studio by Christopher Shivers.",
      },
      { property: "og:title", content: "Terms & Conditions — SYNCLAB" },
      {
        property: "og:description",
        content: "Terms governing use of the SYNCLAB browser music studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsRoute,
});

function TermsRoute() {
  return (
    <LegalPage title="Terms & Conditions" updated="21 September 2026">
      <p>
        SYNCLAB is operated by <strong>Christopher Shivers</strong> ("SYNCLAB", "we", "us"), a sole
        trader based in Detroit, Michigan, United States. These terms form an agreement between you
        and Christopher Shivers. Questions: <strong>christophershivers@synclabsapp.com</strong>.
      </p>

      <h2>1. Acceptance</h2>
      <p>
        By creating an account, subscribing, or continuing to use SYNCLAB you agree to these terms.
        If you use SYNCLAB on behalf of an organisation you confirm you have authority to bind it. If
        you are an individual, you confirm you are of legal age in your country.
      </p>

      <h2>2. The service</h2>
      <p>
        SYNCLAB is a browser-based digital audio workstation: timeline recording, instruments, drum
        machine, piano roll, sampler, mixer, effects, mastering and export. Processing happens in
        your browser using Web Audio; some features depend on your device, microphone permissions
        and browser capabilities. Native plugin (VST/AU/CLAP) playback requires a separate desktop
        bridge and is not part of the browser product.
      </p>

      <h2>3. Licence and restrictions</h2>
      <p>
        We grant you a limited, non-exclusive, non-transferable right to use SYNCLAB within the plan
        you have selected. You may not reverse engineer, resell or redistribute the service, or
        circumvent technical or plan limits.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>No unlawful use, fraud, spam or abuse of other users.</li>
        <li>No infringement of anyone's copyright, trademark or other rights.</li>
        <li>
          No interference with security: malware, probing, load testing, scraping or unauthorised
          access attempts.
        </li>
        <li>You are responsible for keeping your account credentials confidential and for all activity under your account, and for providing accurate account information.</li>
      </ul>

      <h2>5. Your content</h2>
      <p>
        You keep ownership of the audio, MIDI, projects and recordings you create or upload. You
        grant us a limited licence to host, store and process that content solely to provide the
        service (cloud saving, rendering, export). You confirm you hold the rights to any audio,
        samples or recordings you bring into SYNCLAB.
      </p>
      <p>
        Rights holders may report infringing material to{" "}
        <strong>christophershivers@synclabsapp.com</strong>; we
        will review takedown requests and may remove content or suspend accounts for repeated
        infringement.
      </p>

      <h2>6. Our intellectual property</h2>
      <p>
        SYNCLAB, including its software, audio engine, presets, documentation, name and branding,
        remains the property of Christopher Shivers. Nothing in these terms transfers ownership to
        you.
      </p>

      <h2>7. Audio processing disclosure</h2>
      <p>
        Features such as stem separation, voice removal, mastering and beat detection use on-device
        signal processing, not trained AI models. Results vary by source material and are not
        guaranteed to be clean or artefact-free.
      </p>

      <h2>8. Service level</h2>
      <p>
        We work to keep SYNCLAB available and reliable, but we do not guarantee uninterrupted or
        error-free performance. To the fullest extent permitted by law we disclaim implied
        warranties of merchantability and fitness for a particular purpose. Keep your own backups of
        important work.
      </p>

      <h2>9. Payment and subscription terms</h2>
      <p>
        Plans and prices are shown on our <strong>Pricing</strong> page. Payment, billing,
        currency, tax, cancellation and refund mechanics are handled by Paddle under the{" "}
        <a
          className="underline"
          href="https://www.paddle.com/legal/checkout-buyer-terms"
          target="_blank"
          rel="noreferrer"
        >
          Paddle Buyer Terms
        </a>
        . Subscriptions renew automatically at the interval you chose until cancelled. If you cancel,
        you keep access until the end of the period you have already paid for. Switching between
        monthly and yearly is prorated automatically.
      </p>

      <h2>10. Merchant of Record</h2>
      <p>
        Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant
        of Record for all our orders. Paddle provides all customer service inquiries and handles
        returns.
      </p>

      <h2>11. Suspension and termination</h2>
      <p>
        We may suspend or terminate access for material breach of these terms, non-payment, security
        or fraud risk, or repeated or serious policy violations. You may stop using SYNCLAB at any
        time. When access ends you may export your projects for 30 days, after which stored content
        may be deleted.
      </p>

      <h2>12. Liability</h2>
      <p>
        To the extent permitted by law, we are not liable for indirect, consequential or special
        damages, including lost profits, lost data or lost goodwill. Our aggregate liability is
        limited to the fees you paid in the 12 months before the claim. Nothing excludes liability
        for fraud, death or personal injury where the law does not allow exclusion.
      </p>

      <h2>13. Indemnity</h2>
      <p>
        You indemnify us against claims arising from your content, your unlawful use of the service,
        or your breach of these terms.
      </p>

      <h2>14. General</h2>
      <p>
        These terms are governed by the laws of the State of Michigan, USA, and disputes are subject
        to the courts of that state. You may not assign this agreement without our consent; we may
        assign it in connection with a merger or acquisition. Neither party is liable for delays
        caused by events beyond reasonable control. We may update these terms; material changes will
        be announced in the app.
      </p>
    </LegalPage>
  );
}
