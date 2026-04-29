import { SiteHeader } from "@/components/site-header";

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
    question: "How can I use AI to make music?",
    answer:
      "Use an AI music generator to sketch ideas, create loops, draft lyrics, build background beds, or explore alternate versions. Export the audio, review the tool's license terms, add clear metadata, then encode the finished file with SonoSig so the generated track carries a wallet-signed proof.",
    links: [
      {
        href: "https://interactivedemo.withgoogle.com/songmaker/",
        label: "Google Song Maker",
      },
      { href: "https://suno.com/", label: "Suno" },
      { href: "https://www.udio.com/", label: "Udio" },
      { href: "https://stableaudio.com/", label: "Stable Audio" },
      {
        href: "https://www.loudly.com/ai-music-generator",
        label: "Loudly",
      },
    ],
  },
  {
    question: "Why is WAV or AIFF preferred for verification?",
    answer:
      "WAV and AIFF keep the embedded payload in PCM samples, so SonoSig can recompute the signed audio hash directly. M4A and OGG are available for convenient local export and sharing, but lossy encoding can change sample data, so exact audio-hash verification is strongest with WAV and AIFF.",
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
      "No. Decoding, encoding, preview, export, and verification happen locally in your browser.",
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
              Frequently asked questions.
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-300">
              Practical answers about SonoSig proofs, audio encoding, wallet
              signatures, verification, and creator workflows.
            </p>
          </div>

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
                {item.links?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.links.map((link) => (
                      <a
                        className="rounded-md border border-cyan-300/30 px-3 py-1.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-200 hover:bg-cyan-300/10 hover:text-white"
                        href={link.href}
                        key={link.href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
