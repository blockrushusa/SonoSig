import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

const DONATION_ADDRESS = "0x769376098c803F9636aE9b33B4d158bEa2342a95";
const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(
  DONATION_ADDRESS,
)}`;

const benefits = [
  {
    title: "Wallet-native attribution",
    body: "A SIWE signature proves the connected wallet approved the claim. That makes an audio proof portable across apps, marketplaces, and communities that already understand Ethereum wallets.",
  },
  {
    title: "Proof travels with the audio",
    body: "SonoSig encodes proof data into the audio output instead of relying only on filenames, ID3 tags, or platform metadata that can be stripped during upload, export, or sharing.",
  },
  {
    title: "Tamper-evident verification",
    body: "Verification can compare the embedded proof with the signed wallet message and audio fingerprint. If the file or claim changes, the proof should no longer match.",
  },
  {
    title: "Client-side privacy",
    body: "Encoding and verification run in the browser. Your source audio does not need to be uploaded just to create or inspect a proof.",
  },
  {
    title: "Useful before formal registration",
    body: "Creators can mark demos, stems, mixes, and previews at the moment they are shared, before publishing, distribution, or catalog registration is complete.",
  },
  {
    title: "Composable identity",
    body: "A wallet can connect to ENS, collectives, label accounts, onchain releases, or licensing workflows, so the same proof can plug into broader creator infrastructure.",
  },
];

const useCases = [
  {
    title: "Demos and private previews",
    body: "Encode tracks before sending them to collaborators, A&R, playlist curators, clients, or press. The proof helps show who originated the file and when it was signed.",
  },
  {
    title: "Stems, loops, and sample packs",
    body: "Mark individual assets so they keep a creator or rights-holder link after they are downloaded, renamed, imported into a DAW, or passed between teams.",
  },
  {
    title: "Licensing and sync review",
    body: "Attach a wallet-backed claim to review copies used in film, game, ad, and creator licensing workflows, where files often move outside one platform.",
  },
  {
    title: "Marketplaces and collectives",
    body: "Let buyers, collectors, and community members verify that a track was signed by the expected wallet before they trust a listing or claim.",
  },
  {
    title: "AI and remix provenance",
    body: "Mark source audio, generated variations, or approved remixes so downstream listeners can distinguish authorized work from lookalike files.",
  },
  {
    title: "Dispute support",
    body: "A SonoSig proof is not a copyright registration by itself, but it can support a timeline by pairing a signed wallet claim with a specific audio file.",
  },
];

export default function AboutPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/30">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
                About
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
                About SonoSig
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
                SonoSig helps creators attach wallet-signed provenance to audio
                files, making attribution easier to verify as music moves across
                collaborators, platforms, and licensing workflows.
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

          <section className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Audio provenance
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Audio provenance, signed by your wallet.
            </h2>
            <p className="mt-6 text-lg leading-8 text-zinc-300">
              SonoSig helps creators attach a verifiable wallet claim to audio so
              attribution can survive ordinary sharing, exports, and platform
              changes.
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
                key={benefit.title}
              >
                <h3 className="text-lg font-semibold text-white">
                  {benefit.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {benefit.body}
                </p>
              </article>
            ))}
          </section>

          <section className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-6">
            <h2 className="text-2xl font-semibold text-white">
              Where SonoSig Fits
            </h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {useCases.map((useCase) => (
                <article key={useCase.title}>
                  <h3 className="text-base font-semibold text-cyan-100">
                    {useCase.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {useCase.body}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
