import { HomeStartButton } from "@/components/home-start-button";
import { InteractiveSonoSigLogo } from "@/components/interactive-sonosig-logo";
import { SiteHeader } from "@/components/site-header";
import { SupportChatbot } from "@/components/support-chatbot";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />

      <section className="flex flex-1 items-start px-6 pb-24 pt-20 sm:pt-24 lg:px-16 lg:pb-[7.2rem] lg:pt-[12vh]">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[minmax(0,680px)_minmax(340px,480px)] lg:justify-center lg:gap-10">
          <div className="max-w-[680px]">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/70">
              Sort the slop
            </p>
            <h2 className="max-w-[13.5ch] text-[clamp(2.75rem,4.6vw,5.25rem)] font-semibold leading-[1] tracking-normal text-white">
              Sign the sound.
            </h2>
            <p className="mt-7 max-w-[620px] text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
              Agent-accessible identity and trust system for media. Works with{" "}
              <a
                className="text-inherit underline decoration-cyan-300/50 underline-offset-4 transition hover:decoration-cyan-200"
                href="https://pacstac.com/?utm_source=sonosig&utm_medium=homepage&utm_campaign=audio_provenance"
                rel="noreferrer"
                target="_blank"
              >
                PacStac
              </a>{" "}
              &{" "}
              <a
                className="text-inherit underline decoration-cyan-300/50 underline-offset-4 transition hover:decoration-cyan-200"
                href="https://ens.domains/?utm_source=sonosig&utm_medium=homepage&utm_campaign=audio_provenance"
                rel="noreferrer"
                target="_blank"
              >
                ENS
              </a>{" "}
              to provide instant trust for agents, portable provenance, public
              discovery, and agentic access assets you steward.
            </p>
            <HomeStartButton />
          </div>

          <div className="flex justify-center lg:justify-start">
            <InteractiveSonoSigLogo />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-[3.6rem] lg:px-16">
        <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(420px,1fr)] lg:items-start">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Visitor support
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight text-white md:text-4xl">
              Questions before you sign or verify?
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">
              Ask about SonoSig, wallet-signed audio proofs, PacStac discovery,
              ENS pointers, verification, transactions, or developer setup.
            </p>
          </div>
          <SupportChatbot compact />
        </div>
      </section>
    </main>
  );
}
