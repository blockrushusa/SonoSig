import { ProofDraftCard } from "@/components/proof-draft-card";
import { SiteHeader } from "@/components/site-header";
import { WalletConnect } from "@/components/wallet-connect";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />

      <section className="grid flex-1 items-center gap-10 px-6 py-12 lg:grid-cols-[1fr_420px] lg:px-16">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-zinc-400">
            Next.js · React · TypeScript · wagmi · viem · RainbowKit · Firebase
          </p>
          <h2 className="text-5xl font-semibold leading-tight text-white">
            Connect a wallet to anchor audio proofs.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Sonosig is set up with a typed Web3 foundation for wallet-aware
            workflows. The connector supports Ethereum mainnet, Base, and
            Sepolia out of the box.
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
          <h3 className="text-lg font-semibold">Wallet status</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Use the wallet control to connect, switch networks, and prepare
            account-aware signing flows.
          </p>
          <div className="mt-6">
            <WalletConnect />
          </div>
        </div>
      </section>

      <section className="px-6 pb-12 lg:px-16">
        <ProofDraftCard />
      </section>
    </main>
  );
}
