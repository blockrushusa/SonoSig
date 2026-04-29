"use client";

import { useEffect, useMemo, useState } from "react";
import { getIdToken } from "firebase/auth";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

type SystemCheck = {
  detail: string;
  label: string;
  status: "ok" | "warn" | "error";
};

type SystemResponse = {
  checks: SystemCheck[];
  generatedAt: string;
  runtime: {
    node: string;
    uptimeSeconds: number;
  };
};

export function AdminSystemStatus() {
  const { user } = useAuthUser();
  const [data, setData] = useState<SystemResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const statusCounts = useMemo(() => {
    const counts = { error: 0, ok: 0, warn: 0 };

    for (const check of data?.checks ?? []) {
      counts[check.status] += 1;
    }

    return counts;
  }, [data]);

  async function loadSystemStatus() {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const token = await getIdToken(user);
      const response = await fetch("/api/admin/system", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as SystemResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to load system status.");
      }

      setData(payload as SystemResponse);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load system status.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialStatus() {
      if (!user) {
        return;
      }

      try {
        const token = await getIdToken(user);
        const response = await fetch("/api/admin/system", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json()) as
          | SystemResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload ? payload.error : "Unable to load system status.",
          );
        }

        if (isActive) {
          setData(payload as SystemResponse);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load system status.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialStatus();

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
              System status
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Server-side readiness for auth, storage, registry integrations,
              wallet automation, and the local MCP agent bridge.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300/70 hover:text-white disabled:cursor-wait disabled:opacity-60"
            disabled={isLoading}
            onClick={() => void loadSystemStatus()}
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

        {error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="h-72 animate-pulse rounded-lg bg-white/[0.06]" />
        ) : data ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Healthy" value={statusCounts.ok} tone="ok" />
              <MetricCard label="Warnings" value={statusCounts.warn} tone="warn" />
              <MetricCard label="Errors" value={statusCounts.error} tone="error" />
              <MetricCard
                label="Uptime"
                value={formatDuration(data.runtime.uptimeSeconds)}
                tone="neutral"
              />
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                    Runtime
                  </p>
                  <p className="mt-2 font-mono text-sm text-zinc-300">
                    {data.runtime.node}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Updated {new Date(data.generatedAt).toLocaleString()}
                </p>
              </div>
            </section>

            <section className="grid gap-3">
              {data.checks.map((check) => (
                <StatusRow check={check} key={check.label} />
              ))}
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "error" | "neutral" | "ok" | "warn";
  value: number | string;
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
      : tone === "warn"
        ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
        : tone === "error"
          ? "border-red-300/30 bg-red-400/10 text-red-100"
          : "border-white/10 bg-white/[0.04] text-zinc-100";

  return (
    <div className={`rounded-lg border p-5 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function StatusRow({ check }: { check: SystemCheck }) {
  const statusClass =
    check.status === "ok"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
      : check.status === "warn"
        ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
        : "border-red-300/30 bg-red-400/10 text-red-100";

  return (
    <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 md:grid-cols-[180px_110px_minmax(0,1fr)] md:items-center">
      <p className="font-medium text-zinc-100">{check.label}</p>
      <span
        className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusClass}`}
      >
        {check.status}
      </span>
      <p className="text-sm leading-6 text-zinc-400">{check.detail}</p>
    </div>
  );
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
