import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

const DONATION_ADDRESS = "0x769376098c803F9636aE9b33B4d158bEa2342a95";
const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(
  DONATION_ADDRESS,
)}`;

export default function AboutPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/30">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              About
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              About SonoSig
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Sonosig is a work in progress for the ETHGlobal Open Agents 2026
              Hackathon. Developed by Blockrush.
            </p>
            <Link
              className="mt-8 inline-flex rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
              href="/faq"
            >
              Read the FAQ
            </Link>
          </div>

          <aside className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-6 shadow-2xl shadow-cyan-950/20">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Support
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-white">
              Support this project
            </h2>
            <div className="mt-6 rounded-lg border border-white/10 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Donation address QR code"
                className="mx-auto h-56 w-56"
                height="220"
                src={qrCodeUrl}
                width="220"
              />
            </div>
            <p className="mt-5 break-all rounded-md border border-white/10 bg-zinc-950 p-4 font-mono text-sm leading-6 text-zinc-300">
              {DONATION_ADDRESS}
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
