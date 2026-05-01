"use client";

import {
  decodeFunctionResult,
  encodeFunctionData,
  isAddress,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";
import { namehash } from "viem/ens";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";

const ENS_RECORD_KEYS = [
  { key: "com.sonosig", label: "SonoSig" },
  { key: "avatar", label: "Avatar" },
  { key: "description", label: "Description" },
  { key: "url", label: "Website" },
  { key: "email", label: "Email" },
  { key: "notice", label: "Notice" },
  { key: "keywords", label: "Keywords" },
  { key: "location", label: "Location" },
  { key: "com.twitter", label: "Twitter / X" },
  { key: "com.github", label: "GitHub" },
  { key: "com.discord", label: "Discord" },
  { key: "com.linkedin", label: "LinkedIn" },
  { key: "com.instagram", label: "Instagram" },
  { key: "org.telegram", label: "Telegram" },
] as const;

const ENS_RESOLVER_READ_ABI = [
  {
    inputs: [{ internalType: "bytes32", name: "node", type: "bytes32" }],
    name: "addr",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "node", type: "bytes32" }],
    name: "contenthash",
    outputs: [{ internalType: "bytes", name: "", type: "bytes" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "node", type: "bytes32" },
      { internalType: "string", name: "key", type: "string" },
    ],
    name: "text",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type EnsTextRecord = {
  key: string;
  label: string;
  status: "empty" | "error" | "found";
  value: string;
};

type EnsScan = {
  address: string;
  contenthash: string;
  resolver: Address;
  sonosig: {
    claimId?: string;
    isValid: boolean;
    pointer?: string;
    raw: string;
    version?: number;
  } | null;
  textRecords: EnsTextRecord[];
};

type EnsNamesResponse = {
  names?: string[];
};

type EnsResolverResponse = {
  error?: string;
  resolver?: string;
};

type EthCallClient = {
  request: (args: {
    method: "eth_call";
    params: [{ data: Hex; to: Address }, "latest"];
  }) => Promise<Hex>;
};

export function EnsToolsStudio() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const [ensNames, setEnsNames] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [customName, setCustomName] = useState("");
  const [isLoadingNames, setIsLoadingNames] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scan, setScan] = useState<EnsScan | null>(null);
  const [status, setStatus] = useState("");

  const activeName = useMemo(
    () => (selectedName === "__custom__" ? customName.trim() : selectedName),
    [customName, selectedName],
  );

  useEffect(() => {
    let isActive = true;

    if (!address) {
      queueMicrotask(() => {
        if (!isActive) {
          return;
        }

        setEnsNames([]);
        setSelectedName("");
        setCustomName("");
        setScan(null);
        setStatus("");
      });

      return () => {
        isActive = false;
      };
    }

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      setIsLoadingNames(true);
      setScan(null);
      setStatus("Loading ENS names owned by this wallet...");
    });

    fetch(`/api/ens/names?address=${address}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load ENS names.");
        }

        return (await response.json()) as EnsNamesResponse;
      })
      .then((body) => {
        if (!isActive) {
          return;
        }

        const names = body.names ?? [];
        setEnsNames(names);
        setSelectedName(names[0] ?? "");
        trackEvent("ens_names_loaded", {
          count: names.length,
          wallet_connected: true,
        });
        setStatus(
          names.length
            ? `Found ${names.length} ENS name${names.length === 1 ? "" : "s"}.`
            : "No owned ENS names were found for this wallet.",
        );
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setEnsNames([]);
        setSelectedName("");
        trackEvent("ens_names_load_failed", {
          reason:
            error instanceof Error ? error.message : "Unable to load ENS names.",
        });
        setStatus(
          error instanceof Error ? error.message : "Unable to load ENS names.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingNames(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [address]);

  async function handleScan() {
    if (!isConnected || !address) {
      setStatus("Connect a wallet first.");
      trackEvent("ens_scan_blocked", { reason: "wallet_not_connected" });
      return;
    }

    if (!activeName) {
      setStatus("Choose or enter an ENS name to scan.");
      trackEvent("ens_scan_blocked", { reason: "missing_ens_name" });
      return;
    }

    if (!walletClient) {
      setStatus("Wallet is not ready. Reconnect your wallet and try again.");
      trackEvent("ens_scan_blocked", { reason: "wallet_client_unavailable" });
      return;
    }

    setIsScanning(true);
    setScan(null);
    setStatus("Resolving ENS name...");
    trackEvent("ens_scan_start");

    try {
      if (chainId !== mainnet.id) {
        await switchChainAsync({ chainId: mainnet.id });
      }

      const resolver = await fetchEnsResolver(activeName);
      setStatus("Scanning resolver records...");

      const nextScan = await scanEnsName({
        name: activeName,
        resolver,
        walletClient,
      });

      setScan(nextScan);
      setStatus(`Scan complete for ${activeName}.`);
      trackEvent("ens_scan_success", {
        has_resolver: Boolean(nextScan.resolver),
        record_count: nextScan.textRecords.length,
      });
    } catch (error) {
      trackEvent("ens_scan_failed", {
        reason:
          error instanceof Error ? error.message : "Unable to scan ENS records.",
      });
      setStatus(
        error instanceof Error ? error.message : "Unable to scan ENS records.",
      );
    } finally {
      setIsScanning(false);
    }
  }

  const foundRecords = scan?.textRecords.filter((record) => record.status === "found") ?? [];
  const missingRecords =
    scan?.textRecords.filter((record) => record.status !== "found") ?? [];

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            Tools
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
            ENS record scanner.
          </h1>
        </div>
        <div className="rounded-md border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
          {address ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono">{truncateMiddle(address, 10, 8)}</span>
              <a
                className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
                href={`https://etherscan.io/address/${address}`}
                rel="noreferrer"
                target="_blank"
              >
                Open on Etherscan
              </a>
            </div>
          ) : (
            <span>Wallet not connected</span>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-4 rounded-md border border-cyan-300/20 bg-cyan-300/5 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-300">ENS name</span>
              <select
                className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300 disabled:opacity-50"
                disabled={!ensNames.length || isLoadingNames}
                onChange={(event) => {
                  setSelectedName(event.target.value);
                  setScan(null);
                }}
                value={ensNames.includes(selectedName) ? selectedName : "__custom__"}
              >
                {ensNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="__custom__">Custom ENS</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-zinc-300">
                Alternate ENS
              </span>
              <input
                className="rounded-md border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none transition focus:border-cyan-300"
                onChange={(event) => {
                  setSelectedName("__custom__");
                  setCustomName(event.target.value);
                  setScan(null);
                }}
                placeholder={isLoadingNames ? "Loading names..." : "name.eth"}
                value={selectedName === "__custom__" ? customName : ""}
              />
            </label>
          </div>
          <button
            className="w-fit rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isScanning || !address || !activeName}
            onClick={handleScan}
            type="button"
          >
            {isScanning ? "Scanning..." : "Scan ENS"}
          </button>
        </div>
        <p className="break-words text-sm leading-6 text-zinc-400">{status}</p>
      </div>

      {scan ? (
        <div className="mt-6 grid gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            <InfoPanel label="Resolver" value={scan.resolver} />
            <InfoPanel
              label="Address"
              href={scan.address ? `https://etherscan.io/address/${scan.address}` : undefined}
              tone={
                scan.address.toLowerCase() === address?.toLowerCase()
                  ? "good"
                  : "neutral"
              }
              value={scan.address || "Not set"}
            />
            <InfoPanel
              label="Contenthash"
              value={scan.contenthash || "Not set"}
            />
          </div>

          <section className="rounded-md border border-white/10 bg-zinc-950 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                  SonoSig
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {scan.sonosig?.isValid ? "SonoSig record found" : "No SonoSig record"}
                </h2>
              </div>
              {scan.sonosig?.isValid ? (
                <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 font-mono text-xs text-cyan-100">
                  {scan.sonosig.pointer ? "PacStac wallet" : `v${scan.sonosig.version ?? 1}`}
                </span>
              ) : null}
            </div>
            {scan.sonosig?.isValid ? (
              <code className="mt-4 block break-all rounded-md border border-white/10 bg-black/40 px-3 py-3 font-mono text-xs text-zinc-300">
                {scan.sonosig.pointer ?? scan.sonosig.claimId}
              </code>
            ) : (
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                Publish from the Post page to add a compact{" "}
                <span className="font-mono text-zinc-300">com.sonosig</span>{" "}
                text record for this ENS name.
              </p>
            )}
          </section>

          <section className="rounded-md border border-white/10 bg-zinc-950 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                  Text records
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {foundRecords.length} populated / {scan.textRecords.length} scanned
                </h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {foundRecords.map((record) => (
                <RecordRow key={record.key} record={record} />
              ))}
              {missingRecords.length ? (
                <details className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-300">
                    Empty or unreadable records
                  </summary>
                  <div className="mt-3 grid gap-2">
                    {missingRecords.map((record) => (
                      <RecordRow key={record.key} muted record={record} />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function InfoPanel({
  href,
  label,
  tone = "neutral",
  value,
}: {
  href?: string;
  label: string;
  tone?: "good" | "neutral";
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p
        className={
          tone === "good"
            ? "mt-3 break-all font-mono text-sm text-cyan-200"
            : "mt-3 break-all font-mono text-sm text-zinc-300"
        }
      >
        {value}
      </p>
      {href ? (
        <a
          className="mt-3 inline-flex rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          Open on Etherscan
        </a>
      ) : null}
    </div>
  );
}

function RecordRow({
  muted = false,
  record,
}: {
  muted?: boolean;
  record: EnsTextRecord;
}) {
  return (
    <div className="grid gap-2 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)]">
      <div>
        <p className={muted ? "text-sm text-zinc-500" : "text-sm text-zinc-300"}>
          {record.label}
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-600">{record.key}</p>
      </div>
      <p
        className={
          muted
            ? "break-all font-mono text-xs text-zinc-600"
            : "break-all font-mono text-xs text-zinc-300"
        }
      >
        {record.value || (record.status === "error" ? "Unreadable" : "Not set")}
      </p>
    </div>
  );
}

async function fetchEnsResolver(name: string) {
  const response = await fetch(`/api/ens/resolver?name=${encodeURIComponent(name)}`);
  const body = (await response.json()) as EnsResolverResponse;

  if (!response.ok || !body.resolver || !isAddress(body.resolver)) {
    throw new Error(body.error ?? "This ENS name has no resolver configured.");
  }

  return body.resolver;
}

async function scanEnsName({
  name,
  resolver,
  walletClient,
}: {
  name: string;
  resolver: Address;
  walletClient: WalletClient;
}) {
  const node = namehash(name);
  const callClient = walletClient as unknown as EthCallClient;
  const address = await readResolverAddress(callClient, resolver, node);
  const contenthash = await readResolverContenthash(callClient, resolver, node);
  const textRecords: EnsTextRecord[] = [];

  for (const record of ENS_RECORD_KEYS) {
    const value = await readResolverText(callClient, resolver, node, record.key);
    textRecords.push({
      key: record.key,
      label: record.label,
      status: value === null ? "error" : value ? "found" : "empty",
      value: value ?? "",
    });
  }

  const sonosigValue =
    textRecords.find((record) => record.key === "com.sonosig")?.value ?? "";

  return {
    address,
    contenthash,
    resolver,
    sonosig: parseSonoSigRecord(sonosigValue),
    textRecords,
  } satisfies EnsScan;
}

async function readResolverAddress(
  client: EthCallClient,
  resolver: Address,
  node: Hex,
) {
  try {
    const data = encodeFunctionData({
      abi: ENS_RESOLVER_READ_ABI,
      args: [node],
      functionName: "addr",
    });
    const result = await client.request({
      method: "eth_call",
      params: [{ data, to: resolver }, "latest"],
    });
    const decoded = decodeFunctionResult({
      abi: ENS_RESOLVER_READ_ABI,
      data: result,
      functionName: "addr",
    });

    return typeof decoded === "string" ? decoded : "";
  } catch {
    return "";
  }
}

async function readResolverContenthash(
  client: EthCallClient,
  resolver: Address,
  node: Hex,
) {
  try {
    const data = encodeFunctionData({
      abi: ENS_RESOLVER_READ_ABI,
      args: [node],
      functionName: "contenthash",
    });
    const result = await client.request({
      method: "eth_call",
      params: [{ data, to: resolver }, "latest"],
    });
    const decoded = decodeFunctionResult({
      abi: ENS_RESOLVER_READ_ABI,
      data: result,
      functionName: "contenthash",
    });

    return typeof decoded === "string" && decoded !== "0x" ? decoded : "";
  } catch {
    return "";
  }
}

async function readResolverText(
  client: EthCallClient,
  resolver: Address,
  node: Hex,
  key: string,
) {
  try {
    const data = encodeFunctionData({
      abi: ENS_RESOLVER_READ_ABI,
      args: [node, key],
      functionName: "text",
    });
    const result = await client.request({
      method: "eth_call",
      params: [{ data, to: resolver }, "latest"],
    });
    const decoded = decodeFunctionResult({
      abi: ENS_RESOLVER_READ_ABI,
      data: result,
      functionName: "text",
    });

    return typeof decoded === "string" ? decoded : "";
  } catch {
    return null;
  }
}

function parseSonoSigRecord(value: string) {
  if (!value) {
    return null;
  }

  if (/^pacstac:wallet:0x[a-fA-F0-9]{40}$/.test(value.trim())) {
    return {
      isValid: true,
      pointer: value.trim(),
      raw: value,
    };
  }

  try {
    const parsed = JSON.parse(value) as {
      latest?: unknown;
      v?: unknown;
    };
    const latest = typeof parsed.latest === "string" ? parsed.latest : "";
    const version = typeof parsed.v === "number" ? parsed.v : undefined;

    return {
      claimId: latest,
      isValid: Boolean(latest),
      raw: value,
      version,
    };
  } catch {
    return {
      isValid: false,
      raw: value,
    };
  }
}

function truncateMiddle(value: string, startLength: number, endLength: number) {
  if (value.length <= startLength + endLength + 3) {
    return value;
  }

  return `${value.slice(0, startLength)}...${value.slice(-endLength)}`;
}
