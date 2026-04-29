"use client";

import { useAccount } from "wagmi";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

export function ProfilePanel() {
  const { address, chain } = useAccount();
  const { user } = useAuthUser();

  return (
    <section className="px-6 py-12 lg:px-16">
      <div className="mx-auto grid max-w-4xl gap-6">
        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/30">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            Profile
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
            Account identity.
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-6 text-zinc-400">
            Your SonoSig profile combines the signed-in app account with the
            currently connected wallet.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <InfoCard label="Email" value={user?.email ?? "Not available"} />
          <InfoCard
            label="Display name"
            value={user?.displayName ?? "Not available"}
          />
          <InfoCard label="Firebase UID" value={user?.uid ?? "Not available"} />
          <InfoCard
            label="Wallet"
            value={address ?? "No wallet connected"}
          />
          <InfoCard
            label="Network"
            value={chain ? `${chain.name} (${chain.id})` : "No wallet network"}
          />
          <InfoCard
            label="Email verified"
            value={user?.emailVerified ? "Yes" : "No"}
          />
        </section>
      </div>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 break-all font-mono text-sm text-zinc-200">{value}</p>
    </div>
  );
}
