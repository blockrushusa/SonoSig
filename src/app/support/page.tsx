import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SupportChatbot } from "@/components/support-chatbot";

export const metadata: Metadata = {
  title: "Support | SonoSig",
  description:
    "Ask questions about SonoSig, audio provenance, PacStac, ENS, verification, and developer support.",
};

export default function SupportPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(420px,1fr)]">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Support
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Get help with SonoSig.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Ask about creating proofs, verifying audio, PacStac registration,
              ENS pointers, transaction history, API setup, or what SonoSig does
              and does not prove.
            </p>
            <div className="mt-8 grid gap-3 text-sm leading-6 text-zinc-400">
              <p>
                SonoSig can help explain technical provenance signals. It does
                not determine legal copyright ownership or recover wallets.
              </p>
              <p>
                For account-specific help, include the relevant claim ID,
                transaction hash, ENS name, or wallet address when you contact
                support.
              </p>
            </div>
          </div>
          <SupportChatbot />
        </div>
      </section>
    </main>
  );
}
