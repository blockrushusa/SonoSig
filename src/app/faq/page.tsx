import { SiteHeader } from "@/components/site-header";

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

const faqs = [
  {
    question: "What is SonoSig?",
    answer:
      "SonoSig is a browser-based tool for adding wallet-signed proof data to audio files and checking that proof later. It is built for creators who need lightweight provenance before audio spreads across platforms.",
  },
  {
    question: "What is SIWE?",
    answer:
      "SIWE means Sign-In with Ethereum. In SonoSig, your wallet signs a structured message that says this wallet is making a claim about this audio. The signature can be verified without trusting SonoSig as the only source of truth.",
  },
  {
    question: "Why encode a SIWE proof into audio?",
    answer:
      "Audio often leaves the platform where it was uploaded. Embedded proof helps preserve attribution and verification context when a file is downloaded, renamed, sent in a chat, or uploaded somewhere else.",
  },
  {
    question: "Is the proof tied to the actual audio?",
    answer:
      "Yes. SonoSig does not only encode that a wallet signed something. It encodes that wallet X signed this specific audio fingerprint, at this time, for this purpose, with this nonce. During verification, the browser recomputes the fingerprint from the watermarked WAV or AIFF and rejects files where the audio no longer matches the signed claim.",
  },
  {
    question: "What fields are embedded in the watermark?",
    answer:
      "The payload includes protocol, ENS name, wallet, audio_fingerprint, audio_hash, manifest, issued_at, nonce, chain_id, signature_type, and signature. SonoSig also keeps local compatibility fields for verification display.",
  },
  {
    question: "Which song metadata can SonoSig import?",
    answer:
      "When available, SonoSig reads common ID3, MP4/iTunes, and WAV INFO tags for title, artist, album, album artist, composer, genre, release date, year, track, disc, ISRC, BPM, key, publisher, copyright, and comments. These fields stay editable before signing.",
  },
  {
    question: "Does this replace copyright registration?",
    answer:
      "No. SonoSig creates a technical proof of a signed claim. It can help with provenance and evidence, but it does not replace legal registration, contracts, split sheets, or professional legal advice.",
  },
  {
    question: "Can a watermark be removed?",
    answer:
      "Any audio watermark has limits. SonoSig is designed to be harder to lose than ordinary metadata, but aggressive editing, destructive conversion, or targeted removal can damage verification.",
  },
  {
    question: "Is my audio uploaded?",
    answer:
      "No for the current browser workflow. Decoding, encoding, preview, export, and verification happen locally in your browser.",
  },
  {
    question: "What should I encode?",
    answer:
      "Use SonoSig for meaningful versions: demos you share, release candidates, stems, client previews, licensed assets, or important revisions. Avoid encoding every tiny scratch file.",
  },
  {
    question: "What makes a proof stronger?",
    answer:
      "Use a wallet people can recognize, include clear song metadata, keep the original exported proof file, and record related context such as collaborators, dates, agreements, or release links.",
  },
];

export default function FaqPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-10">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              FAQ
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Audio provenance, signed by your wallet.
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-300">
              SonoSig helps creators attach a verifiable wallet claim to audio
              so attribution can survive ordinary sharing, exports, and platform
              changes.
            </p>
          </div>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
                key={benefit.title}
              >
                <h2 className="text-lg font-semibold text-white">
                  {benefit.title}
                </h2>
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

          <section className="grid gap-4">
            {faqs.map((item) => (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.04] p-6"
                key={item.question}
              >
                <h2 className="text-xl font-semibold text-white">
                  {item.question}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {item.answer}
                </p>
              </article>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
