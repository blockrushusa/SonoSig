import { SiteHeader } from "@/components/site-header";

const encodingSteps = [
  "The selected audio file is decoded by the browser with the Web Audio API.",
  "SonoSig fingerprints the decoded audio and signs that fingerprint with the SIWE message.",
  "For WAV and AIFF exports, the payload is embedded into low-order PCM sample bits.",
  "For M4A and OGG exports, the browser encodes audio locally and attaches the signed payload for sharing, while exact audio-hash verification is strongest with WAV and AIFF.",
  "The finished file is generated as a browser download. No audio is uploaded.",
];

export default function HelpPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <div className="mx-auto grid max-w-5xl gap-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Help
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              SonoSig Help
            </h1>
          </div>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-semibold text-white">
              How Audio Encoding Works
            </h2>
            <div className="mt-6 grid gap-4">
              {encodingSteps.map((step, index) => (
                <div
                  className="grid gap-3 rounded-md border border-white/10 bg-zinc-950/50 p-4 sm:grid-cols-[2rem_1fr]"
                  key={step}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-sm font-semibold text-zinc-950">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-zinc-300">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-semibold text-white">
              Client-Side Privacy
            </h2>
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              Audio decoding, proof embedding, preview, export, and verification
              run in this browser. Audio files, decoded samples, waveform data,
              metadata, and generated output are not uploaded to a server.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
