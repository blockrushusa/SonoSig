import { SiteHeader } from "@/components/site-header";

const requirements = [
  "An ENS name on Ethereum mainnet with a resolver that supports text records.",
  "A connected wallet that can manage the ENS name or is authorized by the name owner.",
  "Enough ETH for the ENS text-record transaction gas.",
  "At least one PacStac registration associated with the creator wallet.",
];

const workflow = [
  {
    title: "1. Register the proof with PacStac",
    body: "SonoSig submits the wallet-signed audio proof to PacStac so the claim can be indexed by wallet, claim ID, audio hash, fingerprint, and related metadata.",
  },
  {
    title: "2. Publish the ENS pointer",
    body: "SonoSig writes the creator's ENS text record key com.sonosig with a compact PacStac collection pointer.",
  },
  {
    title: "3. Agents resolve the collection",
    body: "Verifiers and agents read the ENS text record, discover the creator's PacStac wallet collection, then query PacStac for the latest registered SonoSig claims.",
  },
];

export default function EnsDocsPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-10">
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              ENS
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              ENS discovery for SonoSig claims.
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-300">
              SonoSig uses ENS as a creator-controlled public pointer, not as
              the full song registry. The ENS record points agents to a PacStac
              wallet collection where multiple audio claims can be discovered.
            </p>
          </div>

          <section className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-6">
            <h2 className="text-2xl font-semibold text-white">
              Current text record format
            </h2>
            <div className="mt-5 rounded-lg border border-white/10 bg-zinc-950 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                ENS text key
              </p>
              <code className="mt-3 block break-all font-mono text-sm text-cyan-100">
                com.sonosig
              </code>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                ENS text value
              </p>
              <code className="mt-3 block break-all font-mono text-sm text-cyan-100">
                pacstac:wallet:0x1234567890abcdef1234567890abcdef12345678
              </code>
            </div>
            <p className="mt-5 text-sm leading-6 text-zinc-300">
              This collection pointer avoids the one-record-per-song problem.
              ENS stores the stable wallet collection location, while PacStac
              stores and indexes all SonoSig claims registered by that wallet.
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {workflow.map((item) => (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
                key={item.title}
              >
                <h2 className="text-lg font-semibold text-white">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {item.body}
                </p>
              </article>
            ))}
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-semibold text-white">
                What verifiers read
              </h2>
              <p className="mt-4 text-sm leading-6 text-zinc-300">
                A verifier resolves the creator ENS name, reads
                <code> com.sonosig</code>, confirms the value starts with
                <code> pacstac:wallet:</code>, and uses the wallet address as
                the PacStac collection key. PacStac remains the source for claim
                lists, status, and per-song metadata.
              </p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-semibold text-white">
                What support should expect
              </h2>
              <p className="mt-4 text-sm leading-6 text-zinc-300">
                ENS transactions may show as complete in the wallet before the
                app refreshes the receipt. SonoSig records submitted
                transactions locally, refreshes pending statuses on the
                Transactions page, and treats submitted ENS updates as visible
                pending actions until confirmation is observed.
              </p>
            </article>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-semibold text-white">
              Requirements
            </h2>
            <ul className="mt-5 grid gap-3">
              {requirements.map((item) => (
                <li
                  className="rounded-md border border-white/10 bg-zinc-950/70 p-4 text-sm leading-6 text-zinc-300"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-6">
            <h2 className="text-2xl font-semibold text-white">
              Legacy claim pointers
            </h2>
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              Earlier SonoSig workflows may have written a single latest claim
              pointer into <code>com.sonosig</code>. New implementations should
              prefer the PacStac wallet collection pointer so one ENS name can
              represent every song registered by the creator wallet.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
