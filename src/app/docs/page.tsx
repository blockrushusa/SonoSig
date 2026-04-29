import { SiteHeader } from "@/components/site-header";

const payloadFields = [
  ["v", "Format version. Current value: 1."],
  ["protocol", "Protocol identifier. Current value: audio-proof-v1."],
  ["wallet", "EVM wallet address that signed the deterministic claim."],
  ["chain_id", "EVM chain ID used in the signed message."],
  ["audio_hash", "sha256:<64 hex chars> hash of the normalized PCM audio."],
  ["audio_fingerprint", "sha256:<64 hex chars> derived audio fingerprint."],
  ["issued_at", "ISO timestamp for claim creation."],
  ["nonce", "Random nonce used to prevent replay."],
  ["signature_type", "Signature scheme. Current value: SIWE."],
  ["signature", "0x-prefixed wallet signature over the exact SIWE message."],
  ["ens", "Optional ENS name associated with the creator wallet."],
  ["manifest", "Optional URL or IPFS URI for richer claim metadata."],
  ["song", "Optional title, artist, album, ISRC, and other song metadata."],
];

const steps = [
  {
    title: "1. Normalize the local audio",
    body: "SonoSig decodes the source audio in the browser and works from PCM sample data. The source file is not uploaded just to create the proof.",
  },
  {
    title: "2. Derive audio identifiers",
    body: "The implementation computes sha256-based audio_hash and audio_fingerprint values from the normalized audio. These values bind the proof to a specific audio signal.",
  },
  {
    title: "3. Build the SIWE-style message",
    body: "SonoSig creates a deterministic message containing the wallet, chain, protocol, audio hash, audio fingerprint, nonce, timestamp, and optional ENS, manifest, and song metadata.",
  },
  {
    title: "4. Sign with the creator wallet",
    body: "The connected wallet signs the exact message. Verifiers must check the signature against that exact message and wallet address.",
  },
  {
    title: "5. Embed SONOSIG1",
    body: "SonoSig serializes the proof as JSON, prefixes it with a SONOSIG1 header and little-endian payload length, then embeds the bytes into the exported audio.",
  },
  {
    title: "6. Verify and register",
    body: "Verification extracts the payload, rebuilds the signed message, checks the signature, and compares the audio identifiers. Claims can then be registered with PacStac and pointed to from ENS.",
  },
];

export default function DocsPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-10">
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Docs
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              SonoSig encoding standard.
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-300">
              SONOSIG1 is a portable audio-proof format that embeds a
              wallet-signed claim into an exported audio file while keeping the
              proof readable by browsers, agents, registries, and public identity
              systems.
            </p>
          </div>

          <section className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-6">
            <h2 className="text-2xl font-semibold text-white">
              Container header
            </h2>
            <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-cyan-300">
                  <tr>
                    <th className="px-4 py-3">Bytes</th>
                    <th className="px-4 py-3">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-zinc-300">
                  <tr>
                    <td className="px-4 py-3 font-mono">0..7</td>
                    <td className="px-4 py-3">
                      ASCII magic string <code>SONOSIG1</code>.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono">8..11</td>
                    <td className="px-4 py-3">
                      Unsigned 32-bit little-endian payload length.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono">12..n</td>
                    <td className="px-4 py-3">
                      UTF-8 JSON proof payload. Current maximum: 16 KB.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {steps.map((step) => (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
                key={step.title}
              >
                <h2 className="text-lg font-semibold text-white">
                  {step.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {step.body}
                </p>
              </article>
            ))}
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-semibold text-white">
              Proof payload
            </h2>
            <div className="mt-5 grid gap-3">
              {payloadFields.map(([field, meaning]) => (
                <div
                  className="grid gap-2 rounded-md border border-white/10 bg-zinc-950/70 p-4 md:grid-cols-[180px_minmax(0,1fr)]"
                  key={field}
                >
                  <code className="font-mono text-sm text-cyan-200">
                    {field}
                  </code>
                  <p className="text-sm leading-6 text-zinc-300">{meaning}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-semibold text-white">
                PCM embedding
              </h2>
              <p className="mt-4 text-sm leading-6 text-zinc-300">
                For WAV and AIFF exports, SonoSig embeds payload bits into the
                least significant bit of sequential 16-bit PCM samples. Each byte
                is written least-significant bit first. Verification reads the
                same sample sequence, reconstructs the header and payload, then
                validates the proof.
              </p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-semibold text-white">
                Compressed exports
              </h2>
              <p className="mt-4 text-sm leading-6 text-zinc-300">
                For M4A and OGG exports, SonoSig appends the SONOSIG1 proof block
                to the encoded file bytes for portability. Exact audio-hash
                verification is strongest with PCM WAV and AIFF because lossy
                encoders can change sample data.
              </p>
            </article>
          </section>

          <section className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-6">
            <h2 className="text-2xl font-semibold text-white">
              Registry and identity layers
            </h2>
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              PacStac verifies and indexes submitted SonoSig claims by claim ID,
              wallet, audio hash, audio fingerprint, and optional ISRC. ENS can
              publish a compact <code>com.sonosig</code> text record that points
              readers to the latest verified PacStac claim for a creator name.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
