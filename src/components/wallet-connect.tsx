"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import { useDisconnect } from "wagmi";

type EnsNamesResponse = {
  names?: string[];
};

type WalletAccount = {
  address: string;
  displayName: string;
  ensAvatar?: string;
};

type WalletChain = {
  hasIcon?: boolean;
  iconBackground?: string;
  iconUrl?: string;
  name?: string;
  unsupported?: boolean;
};

export function WalletConnect() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openChainModal,
        openConnectModal,
      }) => (
        <WalletConnectControls
          account={account}
          chain={chain}
          mounted={mounted}
          onChainClick={openChainModal}
          onConnectClick={openConnectModal}
        />
      )}
    </ConnectButton.Custom>
  );
}

function WalletConnectControls({
  account,
  chain,
  mounted,
  onChainClick,
  onConnectClick,
}: {
  account?: WalletAccount;
  chain?: WalletChain;
  mounted: boolean;
  onChainClick: () => void;
  onConnectClick: () => void;
}) {
  const { disconnect } = useDisconnect();
  const [ensName, setEnsName] = useState("");
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const ready = mounted;
  const connected = ready && account && chain;
  const displayName = ensName || account?.displayName || "";
  const accountLabel = useMemo(
    () =>
      displayName.startsWith("0x") ? truncateAddress(displayName) : displayName,
    [displayName],
  );

  useEffect(() => {
    let isActive = true;

    if (!account?.address) {
      queueMicrotask(() => {
        if (isActive) {
          setEnsName("");
        }
      });
      return () => {
        isActive = false;
      };
    }

    fetch(`/api/ens/names?address=${account.address}`)
      .then(async (response) => {
        if (!response.ok) {
          return { names: [] } satisfies EnsNamesResponse;
        }

        return (await response.json()) as EnsNamesResponse;
      })
      .then((body) => {
        if (isActive) {
          setEnsName(body.names?.[0] ?? "");
        }
      })
      .catch(() => {
        if (isActive) {
          setEnsName("");
        }
      });

    return () => {
      isActive = false;
    };
  }, [account?.address]);

  if (!ready) {
    return (
      <div
        aria-hidden="true"
        className="h-10 w-48 rounded-md bg-white/[0.04]"
      />
    );
  }

  if (!connected) {
    return (
      <button
        className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300/70 hover:text-white"
        onClick={onConnectClick}
        type="button"
      >
        Connect wallet
      </button>
    );
  }

  if (chain.unsupported) {
    return (
      <button
        className="rounded-md border border-red-300/30 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:border-red-200"
        onClick={onChainClick}
        type="button"
      >
        Wrong network
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300/70 hover:text-white"
        onClick={onChainClick}
        type="button"
      >
        {chain.hasIcon ? (
          <span
            className="grid h-5 w-5 place-items-center overflow-hidden rounded-full bg-white/10"
            style={
              chain.iconBackground ? { background: chain.iconBackground } : undefined
            }
          >
            {chain.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="h-5 w-5" src={chain.iconUrl} />
            ) : null}
          </span>
        ) : null}
        {chain.name}
      </button>
      <button
        className="inline-flex max-w-56 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300/70 hover:text-white"
        onClick={() => setIsAccountOpen(true)}
        title={account.address}
        type="button"
      >
        {account.ensAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-5 w-5 rounded-full" src={account.ensAvatar} />
        ) : (
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[10px]">
            0x
          </span>
        )}
        <span className="truncate">{accountLabel}</span>
      </button>
      {isAccountOpen ? (
        <AccountDetailsModal
          account={account}
          copyStatus={copyStatus}
          displayName={accountLabel}
          ensName={ensName}
          onClose={() => setIsAccountOpen(false)}
          onCopy={() => {
            void navigator.clipboard.writeText(account.address);
            setCopyStatus("Copied");
            window.setTimeout(() => setCopyStatus(""), 1400);
          }}
          onDisconnect={() => {
            disconnect();
            setIsAccountOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function AccountDetailsModal({
  account,
  copyStatus,
  displayName,
  ensName,
  onClose,
  onCopy,
  onDisconnect,
}: {
  account: WalletAccount;
  copyStatus: string;
  displayName: string;
  ensName: string;
  onClose: () => void;
  onCopy: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        className="relative w-full max-w-sm rounded-xl border border-white/10 bg-[#272930] p-5 text-center shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Close wallet details"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-lg font-semibold text-zinc-400 transition hover:bg-white/15 hover:text-white"
          onClick={onClose}
          type="button"
        >
          x
        </button>
        {account.ensAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="mx-auto h-16 w-16 rounded-full"
            src={account.ensAvatar}
          />
        ) : (
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-950">
            0x
          </div>
        )}
        <h2 className="mt-4 break-all text-lg font-semibold text-white">
          {displayName}
        </h2>
        {ensName ? (
          <p className="mt-2 break-all font-mono text-xs text-zinc-400">
            {truncateAddress(account.address)}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            className="rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/15"
            onClick={onCopy}
            type="button"
          >
            {copyStatus || "Copy address"}
          </button>
          <button
            className="rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/15"
            onClick={onDisconnect}
            type="button"
          >
            Disconnect
          </button>
        </div>
      </section>
    </div>
  );
}

function truncateAddress(value: string) {
  if (value.length <= 13) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
