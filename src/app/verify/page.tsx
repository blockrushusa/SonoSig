import { AuthGate } from "@/components/auth-gate";
import { SiteHeader } from "@/components/site-header";
import { VerifyWatermarkStudio } from "@/components/verify-watermark-studio";
import Link from "next/link";

export default function VerifyPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AuthGate>
        <section className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-8 lg:px-16">
          <VerifyWatermarkStudio />
          <Link
            className="group grid w-full max-w-3xl gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-5 transition hover:border-cyan-300/50 hover:bg-cyan-300/[0.06]"
            href="/website-scanner"
          >
            <span className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Scan
            </span>
            <span className="text-xl font-semibold text-white">
              Website scanner agent
            </span>
            <span className="text-sm leading-6 text-zinc-400">
              Scan a website for audio files that carry embedded SonoSig proofs.
            </span>
          </Link>
        </section>
      </AuthGate>
    </main>
  );
}
