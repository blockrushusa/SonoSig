import { SiteHeader } from "@/components/site-header";

export default function ContactPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="grid flex-1 gap-10 px-6 py-16 lg:grid-cols-[1fr_520px] lg:px-16">
        <div className="max-w-2xl">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            Contact
          </p>
          <h1 className="text-5xl font-semibold leading-tight text-white">
            Blockrush
          </h1>
          <div className="mt-8 space-y-6 text-lg leading-8 text-zinc-300">
            <address className="not-italic">
              <p>7 Elm St.</p>
              <p>New Haven, CT 06510</p>
            </address>
            <div className="flex flex-col gap-3 text-base sm:flex-row">
              <a
                className="rounded-md bg-cyan-300 px-4 py-2 font-semibold text-zinc-950 transition hover:bg-cyan-200"
                href="mailto:hello@blockrush.com"
              >
                hello@blockrush.com
              </a>
              <a
                className="rounded-md border border-white/15 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
                href="https://x.com/blockrushusa"
                rel="noreferrer"
                target="_blank"
              >
                X / @blockrushusa
              </a>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30">
          <iframe
            className="h-[420px] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=7%20Elm%20St%2C%20New%20Haven%2C%20CT%2006510&output=embed"
            title="Map to Blockrush at 7 Elm St., New Haven, CT 06510"
          />
        </div>
      </section>
    </main>
  );
}
