import { SiteHeader } from "@/components/site-header";

const sections = [
  {
    title: "1. Acceptance of these terms",
    body: [
      "By accessing or using SonoSig, you agree to these Terms of Use. If you do not agree, do not use the service.",
      "SonoSig may update these terms from time to time. Continued use after an update means you accept the updated terms.",
    ],
  },
  {
    title: "2. What SonoSig provides",
    body: [
      "SonoSig is a media provenance product. It lets users create wallet-signed proofs for media, encode those proofs into exported files, verify proofs, register claims with provenance systems such as PacStac, and publish pointers through identity systems such as ENS.",
      "SonoSig provides technical provenance signals. It does not determine copyright ownership, authorship, licensing rights, publishing rights, royalty splits, or legal title to any work.",
    ],
  },
  {
    title: "3. Accounts, wallets, and signatures",
    body: [
      "You are responsible for your account, wallet, private keys, seed phrases, devices, and transactions. SonoSig will never ask for your private key or seed phrase.",
      "When you connect a wallet or sign a message, you are authorizing the wallet action shown by your wallet provider. You are responsible for reviewing wallet prompts before approving them.",
      "SonoSig cannot recover lost wallets, reverse wallet signatures, recover private keys, or undo blockchain transactions.",
    ],
  },
  {
    title: "4. User content and claims",
    body: [
      "You are responsible for any audio, metadata, manifests, links, names, claims, signatures, and other content you create, submit, encode, register, publish, or associate with SonoSig.",
      "You represent that you have the rights, permissions, and authority needed to use any content you submit or claim through SonoSig.",
      "You must not use SonoSig to impersonate another person or entity, submit fraudulent provenance claims, claim works you do not have a good-faith basis to claim, or publish unlawful, abusive, misleading, infringing, or harmful content.",
    ],
  },
  {
    title: "5. Local audio processing and exported files",
    body: [
      "SonoSig is designed so core audio encoding and verification workflows can run locally in your browser where supported. Some metadata, proof, wallet, registration, analytics, or transaction data may still be created, stored, transmitted, or processed as part of the product.",
      "You are responsible for preserving your original files, exported files, proof receipts, wallet records, and claim information. SonoSig is not a backup service.",
      "Audio may fail to process or verify if it is corrupted, unsupported, too large, altered, transcoded, stripped of its proof payload, or processed by third-party tools.",
    ],
  },
  {
    title: "6. PacStac, ENS, x402, blockchains, and third-party services",
    body: [
      "SonoSig may interact with third-party systems such as PacStac, ENS, wallet providers, RPC providers, Firebase, Google Analytics, x402 payment infrastructure, and other blockchain or identity services.",
      "Third-party services are governed by their own terms, policies, fees, availability, and technical behavior. SonoSig is not responsible for third-party downtime, errors, indexing behavior, payment handling, wallet behavior, gas costs, blockchain finality, or third-party data retention.",
      "Blockchain transactions, ENS records, and public registry entries may be public, permanent, difficult or impossible to remove, and outside SonoSig's control.",
    ],
  },
  {
    title: "7. Analytics and service data",
    body: [
      "SonoSig uses analytics, including Google Analytics, to understand page views, product usage, navigation, performance, and feature interactions. Analytics may include event names, page paths, approximate device/browser information, timestamps, referrers, and other usage metadata.",
      "SonoSig may also process account data, Firebase authentication data, wallet addresses, claim identifiers, audio hashes, proof metadata, registration status, transaction hashes, support requests, and operational logs to provide, secure, debug, improve, and support the service.",
      "Do not submit private keys, seed phrases, confidential unreleased material, personal data, or third-party data unless you have authority to do so and accept the risks of using the service.",
    ],
  },
  {
    title: "8. Acceptable use",
    body: [
      "You may not misuse SonoSig, interfere with the service, bypass limits, scrape or attack the service, submit malware, abuse APIs, spam claims, impersonate others, facilitate fraud, violate intellectual property rights, or use SonoSig for unlawful activity.",
      "You may not use SonoSig to create misleading provenance signals, falsely imply endorsement, harass others, publish phishing or malicious links, or overload PacStac, ENS, x402, Firebase, wallet, RPC, or related infrastructure.",
      "SonoSig may suspend, restrict, hide, remove from SonoSig-controlled surfaces, rate-limit, or terminate accounts, claims, API keys, or access when misuse, risk, fraud, legal concerns, or operational harm is suspected.",
    ],
  },
  {
    title: "9. Disputes, copyright complaints, and takedowns",
    body: [
      "SonoSig may receive reports about disputed authorship, disputed ownership, impersonation, copyright concerns, fraudulent claims, or abusive content.",
      "SonoSig may review reports, request evidence, add dispute labels, restrict display on SonoSig-controlled surfaces, preserve records, or escalate matters for legal, trust, and safety review.",
      "SonoSig does not adjudicate legal copyright ownership. A SonoSig proof may be relevant provenance evidence, but it is not a legal ownership determination.",
    ],
  },
  {
    title: "10. Fees, paid features, and x402 payments",
    body: [
      "Some features may require payment, subscription, API access, third-party fees, blockchain gas, x402 payments, or other charges.",
      "You are responsible for reviewing and approving any wallet transaction, payment prompt, gas fee, or paid API request before submitting it.",
      "Unless otherwise required by law or expressly stated in a separate written agreement, fees, gas, blockchain payments, and third-party charges may be non-refundable.",
    ],
  },
  {
    title: "11. Intellectual property",
    body: [
      "SonoSig, the SonoSig name, software, design, documentation, and service materials are owned by SonoSig or its licensors and are protected by applicable intellectual property laws.",
      "You retain whatever rights you have in your own content. By using SonoSig, you grant SonoSig the limited rights needed to operate, secure, display, process, support, debug, and improve the service, including handling claims, metadata, support materials, and public provenance records you submit.",
    ],
  },
  {
    title: "12. No warranties",
    body: [
      "SonoSig is provided on an \"as is\" and \"as available\" basis. To the maximum extent permitted by law, SonoSig disclaims all warranties, whether express, implied, statutory, or otherwise, including warranties of merchantability, fitness for a particular purpose, title, non-infringement, accuracy, availability, security, and error-free operation.",
      "SonoSig does not warrant that proofs will always encode, verify, remain detectable, be accepted by third parties, be indexed publicly, establish ownership, prevent disputes, or remain compatible with every file, wallet, browser, blockchain, registry, or third-party service.",
    ],
  },
  {
    title: "13. Limitation of liability",
    body: [
      "To the maximum extent permitted by law, SonoSig and its operators, affiliates, contributors, service providers, and licensors will not be liable for indirect, incidental, special, consequential, exemplary, punitive, or enhanced damages, lost profits, lost revenue, lost data, lost goodwill, business interruption, reputational harm, wallet loss, transaction loss, third-party service failure, disputed ownership, infringement claims, or misuse of the service.",
      "To the maximum extent permitted by law, SonoSig's total liability for any claim related to the service will not exceed the greater of the amount you paid to SonoSig for the service giving rise to the claim during the three months before the claim arose or one hundred US dollars.",
      "Some jurisdictions do not allow certain limitations of liability, so some limitations may not apply to you. In those cases, liability is limited to the fullest extent permitted by law.",
    ],
  },
  {
    title: "14. Indemnification",
    body: [
      "You agree to defend, indemnify, and hold harmless SonoSig and its operators, affiliates, contributors, service providers, and licensors from claims, damages, losses, liabilities, costs, and expenses arising from your content, claims, misuse of the service, violation of these terms, violation of law, infringement or alleged infringement, wallet activity, blockchain transactions, or disputes with third parties.",
    ],
  },
  {
    title: "15. Suspension and termination",
    body: [
      "SonoSig may suspend, limit, or terminate access to the service at any time when necessary to protect users, comply with law, prevent misuse, address security or operational risk, or enforce these terms.",
      "Termination does not necessarily remove public blockchain records, ENS records, third-party registry entries, cached data, backups, logs, or records retained for legal, security, abuse prevention, accounting, or operational reasons.",
    ],
  },
  {
    title: "16. Contact",
    body: [
      "For support, abuse reports, copyright concerns, privacy requests, or questions about these terms, contact SonoSig through the support or contact channels provided in the service.",
      "These terms are product terms for the SonoSig service. They are not legal advice. SonoSig should have counsel review these terms before public launch and adapt them to the final operating entity, jurisdiction, billing model, and privacy policy.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <div className="mx-auto grid max-w-5xl gap-8">
          <header className="rounded-lg border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/30">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Legal
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Terms of Use
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-300">
              Last updated May 1, 2026. These terms explain the rules for using
              SonoSig, including wallet signatures, media provenance claims,
              public attestations, analytics, third-party services, acceptable
              use, disclaimers, and liability limits.
            </p>
          </header>

          <section className="rounded-lg border border-amber-300/20 bg-amber-400/10 p-5">
            <h2 className="text-lg font-semibold text-amber-100">
              Important provenance notice
            </h2>
            <p className="mt-3 text-sm leading-6 text-amber-50/90">
              SonoSig verifies technical provenance signals such as wallet
              signatures, media fingerprints, claim IDs, and public pointers. It
              does not prove legal copyright ownership or resolve rights
              disputes.
            </p>
          </section>

          <div className="grid gap-5">
            {sections.map((section) => (
              <section
                className="rounded-lg border border-white/10 bg-white/[0.04] p-6"
                key={section.title}
              >
                <h2 className="text-2xl font-semibold text-white">
                  {section.title}
                </h2>
                <div className="mt-4 grid gap-4">
                  {section.body.map((paragraph) => (
                    <p
                      className="text-sm leading-7 text-zinc-300"
                      key={paragraph}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
