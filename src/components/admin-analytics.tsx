"use client";

import { useEffect, useMemo, useState } from "react";
import { getIdToken } from "firebase/auth";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

type AnalyticsResponse = {
  generatedAt: string;
  proofs: {
    draft: number;
    recent7Days: number;
    total: number;
  };
  users: {
    disabled: number;
    emailVerified: number;
    roleSeries: Array<{ label: string; value: number }>;
    total: number;
  };
};

export function AdminAnalytics() {
  const { user } = useAuthUser();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const maxRoleValue = useMemo(
    () => Math.max(1, ...(data?.users.roleSeries.map((item) => item.value) ?? [1])),
    [data],
  );

  async function loadAnalytics() {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const token = await getIdToken(user);
      const response = await fetch("/api/admin/analytics", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as
        | AnalyticsResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to load analytics.");
      }

      setData(payload as AnalyticsResponse);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load analytics.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialAnalytics() {
      if (!user) {
        return;
      }

      try {
        const token = await getIdToken(user);
        const response = await fetch("/api/admin/analytics", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json()) as
          | AnalyticsResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload ? payload.error : "Unable to load analytics.",
          );
        }

        if (isActive) {
          setData(payload as AnalyticsResponse);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load analytics.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialAnalytics();

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
              Analytics
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Usage signals from Firebase Auth roles and Firestore proof drafts.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300/70 hover:text-white disabled:cursor-wait disabled:opacity-60"
            disabled={isLoading}
            onClick={() => void loadAnalytics()}
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
          <div className="h-80 animate-pulse rounded-lg bg-white/[0.06]" />
        ) : data ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Users" value={data.users.total} />
              <MetricCard label="Verified email" value={data.users.emailVerified} />
              <MetricCard label="Proof drafts" value={data.proofs.total} />
              <MetricCard label="Last 7 days" value={data.proofs.recent7Days} />
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                      Role mix
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Users by access level
                    </h2>
                  </div>
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Updated {new Date(data.generatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="mt-6 grid gap-4">
                  {data.users.roleSeries.map((item) => (
                    <BarRow
                      key={item.label}
                      label={item.label}
                      max={maxRoleValue}
                      value={item.value}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                  Proof activity
                </p>
                <div className="mt-6 grid place-items-center">
                  <div className="grid h-48 w-48 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10">
                    <div className="text-center">
                      <p className="text-5xl font-semibold text-white">
                        {data.proofs.total}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-400">
                        total proofs
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  <MiniStat label="Draft" value={data.proofs.draft} />
                  <MiniStat label="Created in last 7 days" value={data.proofs.recent7Days} />
                  <MiniStat label="Disabled users" value={data.users.disabled} />
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-4 text-4xl font-semibold text-white">{value}</p>
    </div>
  );
}

function BarRow({
  label,
  max,
  value,
}: {
  label: string;
  max: number;
  value: number;
}) {
  const width = `${Math.max(4, (value / max) * 100)}%`;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-zinc-200">{label}</span>
        <span className="font-mono text-zinc-400">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-zinc-950">
        <div className="h-full rounded-full bg-cyan-300" style={{ width }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-zinc-950 px-4 py-3">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="font-mono text-sm text-zinc-100">{value}</span>
    </div>
  );
}
