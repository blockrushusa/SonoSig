"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hash } from "viem";
import { usePublicClient } from "wagmi";
import { mainnet } from "wagmi/chains";
import {
  getWeb3Transactions,
  updateWeb3Transaction,
  upsertPacStacRegistrationTransaction,
  WEB3_TRANSACTIONS_EVENT,
  type Web3Transaction,
} from "@/lib/web3-transactions";

export function UserTransactions() {
  const mainnetPublicClient = usePublicClient({ chainId: mainnet.id });
  const [transactions, setTransactions] = useState<Web3Transaction[]>([]);
  const [status, setStatus] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checkingTransactionId, setCheckingTransactionId] = useState<
    string | null
  >(null);

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [transactions],
  );
  const failures = sortedTransactions.filter(
    (transaction) => transaction.status === "failed",
  );
  const submittedTransactions = sortedTransactions.filter(
    (transaction) => transaction.status === "submitted",
  );
  const pacStacTransactions = sortedTransactions.filter(
    (transaction) => transaction.type === "pacstac-registration",
  );
  const ensTransactions = sortedTransactions.filter(
    (transaction) => transaction.type === "ens-text-record",
  );

  const reloadTransactions = useCallback(() => {
    setTransactions(getWeb3Transactions());
  }, []);

  const completeTransaction = useCallback(async (transaction: Web3Transaction) => {
    if (!mainnetPublicClient) {
      setStatus("Ethereum mainnet RPC is not ready.");
      return;
    }

    if (!transaction.hash) {
      setStatus("This history item does not have an on-chain transaction.");
      return;
    }

    setCheckingTransactionId(transaction.id);
    setStatus("");

    try {
      const receipt = await mainnetPublicClient.getTransactionReceipt({
        hash: transaction.hash as Hash,
      });

      if (receipt.status === "success") {
        updateWeb3Transaction(transaction.id, {
          error: undefined,
          status: "confirmed",
        });
        setStatus("Transaction confirmed.");
      } else {
        updateWeb3Transaction(transaction.id, {
          error: "The transaction was mined but reverted.",
          status: "failed",
        });
        setStatus("Transaction failed.");
      }

      reloadTransactions();
    } catch {
      setStatus("Transaction is still waiting for confirmation.");
    } finally {
      setCheckingTransactionId(null);
    }
  }, [mainnetPublicClient, reloadTransactions]);

  const refreshPendingTransactions = useCallback(async (options?: { silent?: boolean }) => {
    if (!mainnetPublicClient) {
      if (!options?.silent) {
        setStatus("Ethereum mainnet RPC is not ready.");
      }
      return;
    }

    const pendingTransactions = getWeb3Transactions().filter(
      (transaction) =>
        transaction.status !== "confirmed" &&
        transaction.chainId === mainnet.id &&
        transaction.hash,
    );

    if (!pendingTransactions.length) {
      if (!options?.silent) {
        setStatus("No pending transactions to refresh.");
      }
      return;
    }

    setIsRefreshing(true);
    if (!options?.silent) {
      setStatus("");
    }

    try {
      let completedCount = 0;
      let pendingCount = 0;

      for (const transaction of pendingTransactions) {
        try {
          const receipt = await mainnetPublicClient.getTransactionReceipt({
            hash: transaction.hash as Hash,
          });

          updateWeb3Transaction(transaction.id, {
            error:
              receipt.status === "reverted"
                ? "The transaction was mined but reverted."
                : undefined,
            status: receipt.status === "success" ? "confirmed" : "failed",
          });
          completedCount += 1;
        } catch {
          pendingCount += 1;
          // The transaction may still be pending or unavailable from this RPC.
        }
      }

      reloadTransactions();
      if (!options?.silent) {
        setStatus(
          completedCount
            ? `${completedCount} transaction${completedCount === 1 ? "" : "s"} completed. ${pendingCount} still pending.`
            : "Submitted transactions are still waiting for confirmation.",
        );
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [mainnetPublicClient, reloadTransactions]);

  useEffect(() => {
    queueMicrotask(() => {
      backfillLatestPacStacRegistration();
      reloadTransactions();
      void refreshPendingTransactions({ silent: true });
    });

    function handleTransactionsUpdated() {
      reloadTransactions();
    }

    window.addEventListener(WEB3_TRANSACTIONS_EVENT, handleTransactionsUpdated);
    window.addEventListener("storage", handleTransactionsUpdated);

    return () => {
      window.removeEventListener(
        WEB3_TRANSACTIONS_EVENT,
        handleTransactionsUpdated,
      );
      window.removeEventListener("storage", handleTransactionsUpdated);
    };
  }, [refreshPendingTransactions, reloadTransactions]);

  return (
    <section className="px-6 py-10 lg:px-16">
      <div className="mx-auto grid max-w-6xl gap-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Account
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Transactions
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Web3 actions submitted from this browser, including ENS updates
              and any detected failures. Non-confirmed on-chain transactions are
              checked when this page loads.
            </p>
          </div>
          <button
            className="rounded-md border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300/70 hover:text-white disabled:cursor-wait disabled:opacity-60"
            disabled={isRefreshing}
            onClick={() => void refreshPendingTransactions()}
            type="button"
          >
            {isRefreshing ? "Refreshing..." : "Refresh pending"}
          </button>
        </div>

        {status ? (
          <div className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-4 text-sm text-cyan-100">
            {status}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Total" value={sortedTransactions.length} />
          <MetricCard label="Submitted" value={submittedTransactions.length} />
          <MetricCard label="PacStac" value={pacStacTransactions.length} />
          <MetricCard label="ENS" value={ensTransactions.length} />
        </div>

        {failures.length ? (
          <section className="grid gap-3 rounded-lg border border-red-400/30 bg-red-500/10 p-5">
            <h2 className="text-lg font-semibold text-red-100">
              Failed transactions
            </h2>
            {failures.map((transaction) => (
              <TransactionRow
                isCompleting={checkingTransactionId === transaction.id}
                key={transaction.id}
                onComplete={completeTransaction}
                transaction={transaction}
              />
            ))}
          </section>
        ) : null}

        {submittedTransactions.length ? (
          <section className="grid gap-3 rounded-lg border border-amber-300/30 bg-amber-400/10 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-amber-100">
                  Waiting for confirmation
                </h2>
                <p className="mt-1 text-sm text-amber-100/80">
                  Complete a submitted action after the network has mined it.
                </p>
              </div>
            </div>
            {submittedTransactions.map((transaction) => (
              <TransactionRow
                isCompleting={checkingTransactionId === transaction.id}
                key={transaction.id}
                onComplete={completeTransaction}
                transaction={transaction}
              />
            ))}
          </section>
        ) : null}

        <section className="grid min-w-0 gap-5 xl:grid-cols-2">
          <HistorySection
            emptyText="No PacStac registrations have been recorded from this browser."
            isCompletingId={checkingTransactionId}
            onComplete={completeTransaction}
            title="PacStac verifications"
            transactions={pacStacTransactions}
          />
          <HistorySection
            emptyText="No ENS web3 transactions have been recorded from this browser."
            isCompletingId={checkingTransactionId}
            onComplete={completeTransaction}
            title="ENS transactions"
            transactions={ensTransactions}
          />
        </section>

        {!sortedTransactions.length ? (
          <section className="grid gap-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
              <p className="text-sm text-zinc-300">
                No web3 transactions have been submitted from this browser yet.
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function HistorySection({
  emptyText,
  isCompletingId,
  onComplete,
  title,
  transactions,
}: {
  emptyText: string;
  isCompletingId: string | null;
  onComplete: (transaction: Web3Transaction) => void;
  title: string;
  transactions: Web3Transaction[];
}) {
  return (
    <section className="grid min-w-0 gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {transactions.length ? (
        transactions.map((transaction) => (
          <TransactionRow
            isCompleting={isCompletingId === transaction.id}
            key={transaction.id}
            onComplete={onComplete}
            transaction={transaction}
          />
        ))
      ) : (
        <p className="rounded-md border border-white/10 bg-zinc-950/50 p-4 text-sm text-zinc-400">
          {emptyText}
        </p>
      )}
    </section>
  );
}

function TransactionRow({
  isCompleting,
  onComplete,
  transaction,
}: {
  isCompleting: boolean;
  onComplete: (transaction: Web3Transaction) => void;
  transaction: Web3Transaction;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-white/10 bg-zinc-950/45 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-white">
              {transaction.title}
            </h2>
            <ServicePill type={transaction.type} />
            <StatusPill status={transaction.status} />
          </div>
          <p className="mt-2 min-w-0 overflow-wrap-anywhere text-sm text-zinc-400 [overflow-wrap:anywhere]">
            {transaction.type === "pacstac-registration"
              ? transaction.claimId
                ? `Claim ID: ${transaction.claimId}`
                : "Registered signed proof"
              : transaction.ensName
              ? `ENS: ${transaction.ensName}`
              : transaction.network}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {transaction.status !== "confirmed" && transaction.hash ? (
            <button
              className="rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
              disabled={isCompleting}
              onClick={() => onComplete(transaction)}
              type="button"
            >
              {isCompleting
                ? "Checking..."
                : transaction.status === "failed"
                  ? "Recheck"
                  : "Complete"}
            </button>
          ) : null}
          {transaction.hash ? (
            <a
              className="rounded-md border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
              href={`https://etherscan.io/tx/${transaction.hash}`}
              rel="noreferrer"
              target="_blank"
            >
              View
            </a>
          ) : (
            <a
              className="rounded-md border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
              href="https://pacstac.com/?utm_source=sonosig&utm_medium=transactions&utm_campaign=audio_provenance"
              rel="noreferrer"
              target="_blank"
            >
              PacStac
            </a>
          )}
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 text-sm md:grid-cols-2">
        <InfoRow
          href={
            transaction.type === "pacstac-registration"
              ? "https://pacstac.com/?utm_source=sonosig&utm_medium=transactions_network&utm_campaign=audio_provenance"
              : undefined
          }
          label="Network"
          value={transaction.network}
        />
        <InfoRow
          label="Submitted"
          value={new Date(transaction.createdAt).toLocaleString()}
        />
        <InfoRow label="Hash" value={transaction.hash ?? "Not on-chain"} />
        <InfoRow
          label="Claim ID"
          value={transaction.claimId ?? "Not recorded"}
        />
        {transaction.registrationStatus ? (
          <InfoRow label="PacStac status" value={transaction.registrationStatus} />
        ) : null}
        {transaction.proofAudioHash ? (
          <InfoRow label="Audio hash" value={transaction.proofAudioHash} />
        ) : null}
      </div>

      {transaction.error ? (
        <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {transaction.error}
        </p>
      ) : null}
    </article>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ServicePill({ type }: { type: Web3Transaction["type"] }) {
  const label = type === "pacstac-registration" ? "PacStac" : "ENS";
  const className =
    type === "pacstac-registration"
      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
      : "border-violet-300/30 bg-violet-400/10 text-violet-100";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: Web3Transaction["status"] }) {
  const className =
    status === "confirmed"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
      : status === "failed"
        ? "border-red-400/30 bg-red-500/10 text-red-100"
        : "border-amber-300/30 bg-amber-400/10 text-amber-100";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {status}
    </span>
  );
}

function InfoRow({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-zinc-950/60 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      {href ? (
        <a
          className="mt-2 block min-w-0 break-words font-mono text-cyan-100 underline decoration-cyan-300/40 underline-offset-4 transition hover:decoration-cyan-200"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          {value}
        </a>
      ) : (
        <p className="mt-2 min-w-0 break-words font-mono text-zinc-200 [overflow-wrap:anywhere]">
          {value}
        </p>
      )}
    </div>
  );
}

function backfillLatestPacStacRegistration() {
  if (typeof window === "undefined") {
    return;
  }

  const storedRegistration = window.localStorage.getItem(
    "sonosig:last-pacstac-registration",
  );

  if (!storedRegistration) {
    return;
  }

  try {
    const parsed = JSON.parse(storedRegistration) as {
      proofAudioHash?: string;
      registration?: {
        claimId?: string;
        createdAt?: string;
        idempotent?: boolean;
        namespace?: string;
        status?: string;
        wallet?: string;
      };
    };

    if (!parsed.registration) {
      return;
    }

    upsertPacStacRegistrationTransaction({
      claimId: parsed.registration.claimId,
      createdAt: parsed.registration.createdAt,
      idempotent: parsed.registration.idempotent,
      namespace: parsed.registration.namespace,
      proofAudioHash: parsed.proofAudioHash,
      registrationStatus: parsed.registration.status,
      wallet: parsed.registration.wallet,
    });
  } catch {
    // Ignore legacy localStorage values that do not match the current shape.
  }
}
