import { SiteHeader } from "@/components/site-header";

export default function ContactPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="flex flex-1 items-start px-6 py-12 lg:px-16">
        <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
          <div className="flex flex-col justify-between gap-12 p-8 lg:p-10">
            <div>
              <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
                Contact
              </p>
              <h1 className="text-5xl font-semibold leading-tight text-white">
                Blockrush
              </h1>
              <address className="mt-8 text-lg leading-8 text-zinc-300 not-italic">
                <p>7 Elm St.</p>
                <p>New Haven, CT 06510</p>
              </address>
            </div>

            <div className="grid gap-3 text-base sm:max-w-md sm:grid-cols-2">
              <a
                className="rounded-md bg-cyan-300 px-4 py-3 text-center font-semibold text-zinc-950 transition hover:bg-cyan-200"
                href="mailto:hello@blockrush.com"
              >
                Email
              </a>
              <a
                className="rounded-md border border-white/15 px-4 py-3 text-center font-semibold text-white transition hover:bg-white/10"
                href="https://x.com/blockrushusa"
                rel="noreferrer"
                target="_blank"
              >
                X / @blockrushusa
              </a>
              <a
                className="rounded-md border border-white/15 px-4 py-3 text-center font-semibold text-white transition hover:bg-white/10 sm:col-span-2"
                href="https://www.google.com/maps/search/?api=1&query=7%20Elm%20St%2C%20New%20Haven%2C%20CT%2006510"
                rel="noreferrer"
                target="_blank"
              >
                Open in Maps
              </a>
            </div>
          </div>

          <div className="min-h-[360px] border-t border-white/10 bg-zinc-950 lg:min-h-[520px] lg:border-l lg:border-t-0">
            <iframe
              className="h-full min-h-[360px] w-full border-0 lg:min-h-[520px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src="https://www.google.com/maps?q=7%20Elm%20St%2C%20New%20Haven%2C%20CT%2006510&output=embed"
              title="Map to Blockrush at 7 Elm St., New Haven, CT 06510"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
