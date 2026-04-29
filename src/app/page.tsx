import { AuthGate } from "@/components/auth-gate";
import { InteractiveSonoSigLogo } from "@/components/interactive-sonosig-logo";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />

      <AuthGate>
        <section className="flex flex-1 items-start px-6 pb-20 pt-20 sm:pt-24 lg:px-16 lg:pb-24 lg:pt-[12vh]">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[minmax(0,680px)_minmax(340px,480px)] lg:justify-between lg:gap-20">
            <div className="max-w-[680px]">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/70">
              Wallet-signed audio provenance
              </p>
              <h2 className="max-w-[13.5ch] text-[clamp(2.75rem,4.6vw,5.25rem)] font-semibold leading-[1] tracking-normal text-white">
                Anchor audio proofs that travel with the file.
              </h2>
              <p className="mt-7 max-w-[620px] text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
                SonoSig links a creator wallet, audio fingerprint, metadata, and
                signature into a portable proof that can be embedded, verified,
                and registered with public trust layers.
              </p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <InteractiveSonoSigLogo />
            </div>
          </div>
        </section>
      </AuthGate>
    </main>
  );
}
