"use client";

import { useEffect, useMemo, useState } from "react";
import { getIdToken } from "firebase/auth";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

type PacStacApiMode = "api-key" | "x402";

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

type ApiConfigResponse = {
  capabilities: {
    pacstacApiKeyConfigured: boolean;
    x402WalletConfigured: boolean;
  };
  config: {
    pacstacApiMode: PacStacApiMode;
  };
  generatedAt: string;
  wallets: {
    baseX402: AdminWallet | null;
  };
};

const modeOptions: Array<{
  description: string;
  label: string;
  value: PacStacApiMode;
}> = [
  {
    description: "Uses the server-side PacStac API key for claim registration.",
    label: "API Key mode",
    value: "api-key",
  },
  {
    description:
      "Uses x402 with the Base wallet for paid PacStac reads. SonoSig claim creation uses PACSTAC_API_KEY until PacStac advertises x402 for namespace writes.",
    label: "x402 mode",
    value: "x402",
  },
];

export function AdminApiConfig() {
  const { user } = useAuthUser();
  const [config, setConfig] = useState<ApiConfigResponse["config"]>({
    pacstacApiMode: "api-key",
  });
  const [capabilities, setCapabilities] =
    useState<ApiConfigResponse["capabilities"] | null>(null);
  const [baseX402Wallet, setBaseX402Wallet] = useState<AdminWallet | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const activeModeStatus = useMemo(() => {
    if (!capabilities) {
      return "";
    }

    if (config.pacstacApiMode === "api-key") {
      return capabilities.pacstacApiKeyConfigured
        ? "PacStac API key is configured."
        : "PACSTAC_API_KEY is not configured.";
    }

    if (!capabilities.x402WalletConfigured) {
      return "BASE_X402_WALLET_PRIVATE_KEY is not configured.";
    }

    return capabilities.pacstacApiKeyConfigured
      ? "Base x402 wallet is configured. PACSTAC_API_KEY is available for SonoSig claim creation when PacStac requires API-key auth."
      : "Base x402 wallet is configured, but PACSTAC_API_KEY is still needed for SonoSig claim creation.";
  }, [capabilities, config.pacstacApiMode]);

  async function getAuthorizationHeader() {
    if (!user) {
      throw new Error("Sign in before editing API config.");
    }

    const token = await getIdToken(user);

    return { Authorization: `Bearer ${token}` };
  }

  function applyResponse(payload: ApiConfigResponse) {
    setConfig(payload.config);
    setCapabilities(payload.capabilities);
    setBaseX402Wallet(payload.wallets.baseX402);
    setGeneratedAt(payload.generatedAt);
  }

  async function loadConfig() {
    setIsLoading(true);
    setError("");
    setStatus("");

    try {
      const headers = await getAuthorizationHeader();
      const response = await fetch("/api/admin/api-config", {
        cache: "no-store",
        headers,
      });
      const payload = (await response.json()) as
        | ApiConfigResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Unable to load API config.",
        );
      }

      applyResponse(payload as ApiConfigResponse);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load API config.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function saveConfig() {
    setIsSaving(true);
    setError("");
    setStatus("");

    try {
      const headers = await getAuthorizationHeader();
      const response = await fetch("/api/admin/api-config", {
        body: JSON.stringify(config),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const payload = (await response.json()) as
        | ApiConfigResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Unable to save API config.",
        );
      }

      applyResponse(payload as ApiConfigResponse);
      setStatus("API config saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save API config.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialConfig() {
      if (!user) {
        return;
      }

      try {
        const token = await getIdToken(user);
        const response = await fetch("/api/admin/api-config", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json()) as
          | ApiConfigResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload ? payload.error : "Unable to load API config.",
          );
        }

        if (isActive) {
          applyResponse(payload as ApiConfigResponse);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load API config.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialConfig();

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
              API config
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Choose how SonoSig talks to the PacStac API and monitor the Base
              x402 wallet used for paid requests.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-md border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300/70 hover:text-white disabled:cursor-wait disabled:opacity-60"
              disabled={isLoading || isSaving}
              onClick={() => void loadConfig()}
              type="button"
            >
              Refresh
            </button>
            <button
              className="rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
              disabled={isLoading || isSaving}
              onClick={() => void saveConfig()}
              type="button"
            >
              {isSaving ? "Saving..." : "Save config"}
            </button>
          </div>
        </div>

        {generatedAt ? (
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Loaded {new Date(generatedAt).toLocaleString()}
          </p>
        ) : null}

        {status ? (
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
              PacStac API mode
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Claim registration
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {modeOptions.map((option) => (
              <label
                className={
                  config.pacstacApiMode === option.value
                    ? "rounded-lg border border-cyan-300/50 bg-cyan-300/10 p-4"
                    : "rounded-lg border border-white/10 bg-zinc-950/50 p-4"
                }
                key={option.value}
              >
                <span className="flex items-start gap-3">
                  <input
                    checked={config.pacstacApiMode === option.value}
                    className="mt-1 h-4 w-4 accent-cyan-300"
                    disabled={isLoading || isSaving}
                    onChange={() =>
                      setConfig({ pacstacApiMode: option.value })
                    }
                    type="radio"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {option.label}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-zinc-400">
                      {option.description}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>

          {activeModeStatus ? (
            <div
              className={
                activeModeStatus.includes("not configured")
                  ? "rounded-md border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100"
                  : "rounded-md border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm text-emerald-100"
              }
            >
              {activeModeStatus}
            </div>
          ) : null}
        </section>

        <section className="grid gap-5 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
              x402 payments
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Base wallet
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              x402 mode uses this wallet on Base mainnet for paid PacStac API
              reads. PacStac claim writes may still require server API-key
              authentication.
            </p>
          </div>

          {isLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-white/[0.06]" />
          ) : baseX402Wallet ? (
            <WalletCard wallet={baseX402Wallet} />
          ) : (
            <div className="rounded-lg border border-white/10 bg-zinc-950/60 p-5 text-sm text-zinc-300">
              Base x402 wallet is not configured.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function WalletCard({ wallet }: { wallet: AdminWallet }) {
  return (
    <article className="rounded-lg border border-white/10 bg-zinc-950/50 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            {wallet.label}
          </p>
          <h3 className="mt-3 break-all font-mono text-lg font-semibold text-white">
            {wallet.address ?? "No public address available"}
          </h3>
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
