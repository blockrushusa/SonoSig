"use client";

import { useEffect, useMemo, useState } from "react";
import { getIdToken } from "firebase/auth";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

type WalletBalance = {
  chain: string;
  native: {
    amount: string | null;
    symbol: string;
  };
  usdc: {
    amount: string | null;
    symbol: "USDC";
  };
  error: string | null;
};

type AdminWallet = {
  id: string;
  label: string;
  address: string | null;
  addressSource: string | null;
  configuredPublicAddress: string | null;
  configuredPublicAddressEnv: string | null;
  configuredPublicAddressMatches: boolean | null;
  privateKeyConfigured: boolean;
  privateKeyEnv: string;
  balances: WalletBalance[];
  notices: string[];
};

type WalletsResponse = {
  generatedAt: string;
  wallets: AdminWallet[];
};

export function AdminWallets() {
  const { user } = useAuthUser();
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const visibleWallets = useMemo(
    () => [...wallets].sort((a, b) => a.label.localeCompare(b.label)),
    [wallets],
  );

  async function loadWallets() {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const token = await getIdToken(user);
      const response = await fetch("/api/admin/wallets", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as
        | WalletsResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Unable to load admin wallets.",
        );
      }

      setWallets((payload as WalletsResponse).wallets);
      setGeneratedAt((payload as WalletsResponse).generatedAt);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load admin wallets.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialWallets() {
      if (!user) {
        return;
      }

      try {
        const token = await getIdToken(user);
        const response = await fetch("/api/admin/wallets", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json()) as
          | WalletsResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload
              ? payload.error
              : "Unable to load admin wallets.",
          );
        }

        if (isActive) {
          setWallets((payload as WalletsResponse).wallets);
          setGeneratedAt((payload as WalletsResponse).generatedAt);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load admin wallets.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialWallets();

    return () => {
      isActive = false;
    };
  }, [user]);

  return (
    <section className="px-6 py-10 lg:px-16">
      <div className="mx-auto grid max-w-6xl gap-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Admin
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Wallets
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Public status for configured admin wallet slots. Private keys and
              RPC credentials never leave the server.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300/70 hover:text-white disabled:cursor-wait disabled:opacity-60"
            disabled={isLoading}
            onClick={() => void loadWallets()}
            type="button"
          >
            <span
              aria-hidden="true"
              className={
                isLoading
                  ? "h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300"
                  : "h-2.5 w-2.5 rounded-full bg-cyan-300"
              }
            />
            Refresh
          </button>
        </div>

        {generatedAt ? (
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Updated {new Date(generatedAt).toLocaleString()}
          </p>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-64 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="h-64 animate-pulse rounded-lg bg-white/[0.06]" />
          </div>
        ) : visibleWallets.length ? (
          <div className="grid gap-4">
            {visibleWallets.map((wallet) => (
              <WalletCard key={wallet.id} wallet={wallet} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-zinc-300">
              No admin wallet env values are configured.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function WalletCard({ wallet }: { wallet: AdminWallet }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            {wallet.label}
          </p>
          <h2 className="mt-3 break-all font-mono text-lg font-semibold text-white">
            {wallet.address ?? "No public address available"}
          </h2>
        </div>
        <StatusPill wallet={wallet} />
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <InfoRow label="Address source" value={wallet.addressSource ?? "Not configured"} />
        <InfoRow
          label="Private key env"
          value={`${wallet.privateKeyEnv}: ${wallet.privateKeyConfigured ? "configured" : "not set"}`}
        />
        <InfoRow
          label="Configured public address"
          value={
            wallet.configuredPublicAddress
              ? `${wallet.configuredPublicAddressEnv}: ${wallet.configuredPublicAddress}`
              : wallet.configuredPublicAddressEnv
                ? `${wallet.configuredPublicAddressEnv}: not set`
                : "No public address env"
          }
        />
        <InfoRow
          label="Public address check"
          value={formatPublicAddressCheck(wallet.configuredPublicAddressMatches)}
        />
      </div>

      {wallet.notices.length ? (
        <div className="mt-5 grid gap-2">
          {wallet.notices.map((notice) => (
            <p
              className="rounded-md border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
              key={notice}
            >
              {notice}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-white/10">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.16em] text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Network</th>
              <th className="px-4 py-3 font-medium">ETH</th>
              <th className="px-4 py-3 font-medium">USDC</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {wallet.balances.length ? (
              wallet.balances.map((balance) => (
                <tr key={balance.chain}>
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    {balance.chain}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-300">
                    {formatBalance(balance.native.amount)} {balance.native.symbol}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-300">
                    {formatBalance(balance.usdc.amount)} USDC
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {balance.error ?? "Ready"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-4 text-zinc-400" colSpan={4}>
                  No balances available for this wallet slot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 break-all font-mono text-zinc-200">{value}</p>
    </div>
  );
}

function StatusPill({ wallet }: { wallet: AdminWallet }) {
  const isReady =
    Boolean(wallet.address) &&
    wallet.configuredPublicAddressMatches !== false &&
    wallet.balances.some((balance) => !balance.error);

  return (
    <span
      className={
        isReady
          ? "inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200"
          : "inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100"
      }
    >
      {isReady ? "Configured" : "Needs attention"}
    </span>
  );
}

function formatPublicAddressCheck(value: boolean | null) {
  if (value === true) {
    return "matches derived address";
  }

  if (value === false) {
    return "does not match derived address";
  }

  return "not applicable";
}

function formatBalance(value: string | null) {
  if (!value) {
    return "--";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  if (numericValue === 0) {
    return "0";
  }

  if (numericValue < 0.000001) {
    return "<0.000001";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: numericValue < 1 ? 6 : 4,
  }).format(numericValue);
}
