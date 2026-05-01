"use client";

import { FormEvent, useMemo, useState } from "react";
import { getIdToken } from "firebase/auth";
import { useAuthUser } from "@/lib/firebase/use-auth-user";

type ScanResult = {
  audioUrl: string;
  detail?: string;
  errors?: string[];
  foundOn?: string[];
  proof?: {
    audioHash?: string;
    ens?: string;
    issuedAt?: string;
    wallet?: string;
  };
  status: string;
};

type ScanReport = {
  advancedDiscovery: {
    feeds?: Array<{ status: string; url: string }>;
    headless?: { attempted?: boolean; error?: string; used?: boolean };
    manifests?: Array<{ status: string; url: string }>;
    robots?: { loaded?: boolean; respected?: boolean };
    sitemaps?: Array<{ status: string; url: string }>;
  };
  errors: Array<{ code: string; message: string; url: string }>;
  markdown: string;
  pages: Array<{ status: string; title?: string; url: string }>;
  results: ScanResult[];
  rootUrl: string;
  scanId: string;
  summary: {
    audioDiscovered: number;
    errors: number;
    notEncoded: number;
    pagesScanned: number;
    payloadChanged: number;
    payloadHashNotChecked: number;
    skipped: number;
    sonosigProofs?: number;
    sonosigVerified: number;
  };
};

export function AdminWebsiteScanner() {
  const { user } = useAuthUser();
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(25);
  const [maxDepth, setMaxDepth] = useState(2);
  const [includeExternalAudio, setIncludeExternalAudio] = useState(true);
  const [headless, setHeadless] = useState(false);
  const [respectRobots, setRespectRobots] = useState(true);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const proofResults = useMemo(
    () =>
      report?.results.filter((result) =>
        result.status.startsWith("sonosig_"),
      ) ?? [],
    [report],
  );
  const proofCount = report?.summary.sonosigProofs ?? proofResults.length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setIsScanning(true);
    setError("");
    setReport(null);

    try {
      const token = await getIdToken(user);
      const response = await fetch("/api/admin/website-scan", {
        body: JSON.stringify({
          headless,
          includeExternalAudio,
          maxDepth,
          maxPages,
          respectRobots,
          url,
        }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as ScanReport | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Website scan failed.");
      }

      setReport(payload as ScanReport);
    } catch (scanError) {
      setError(
        scanError instanceof Error ? scanError.message : "Website scan failed.",
      );
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <section className="px-6 py-10 lg:px-16">
      <div className="mx-auto grid max-w-6xl gap-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            Admin
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
            Website scanner agent
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Send an agent to crawl a public website, discover audio files, and
            check which files carry a SonoSig proof. The agent respects crawl
            limits and keeps temporary downloads out of long-term storage.
          </p>
        </div>

        <form
          className="grid gap-5 rounded-lg border border-white/10 bg-white/[0.04] p-5"
          onSubmit={handleSubmit}
        >
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-zinc-200">Website URL</span>
            <input
              className="rounded-md border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              required
              type="url"
              value={url}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-zinc-200">
                Max pages
              </span>
              <input
                className="rounded-md border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
                max={100}
                min={1}
                onChange={(event) => setMaxPages(Number(event.target.value))}
                type="number"
                value={maxPages}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-zinc-200">
                Max depth
              </span>
              <input
                className="rounded-md border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
                max={4}
                min={0}
                onChange={(event) => setMaxDepth(Number(event.target.value))}
                type="number"
                value={maxDepth}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-4">
            <Checkbox
              checked={respectRobots}
              label="Respect robots.txt"
              onChange={setRespectRobots}
            />
            <Checkbox
              checked={includeExternalAudio}
              label="Include CDN/external audio"
              onChange={setIncludeExternalAudio}
            />
            <Checkbox
              checked={headless}
              label="Try headless discovery"
              onChange={setHeadless}
            />
          </div>

          <div className="flex justify-end">
            <button
              className="rounded-md bg-cyan-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
              disabled={isScanning}
              type="submit"
            >
              {isScanning ? "Agent scanning..." : "Run agent"}
            </button>
          </div>
        </form>

        {error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {report ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Pages" value={report.summary.pagesScanned} />
              <MetricCard label="Audio" value={report.summary.audioDiscovered} />
              <MetricCard
                label="Proofs found"
                tone="ok"
                value={proofCount}
              />
              <MetricCard
                label="Errors"
                tone={report.summary.errors ? "error" : "neutral"}
                value={report.summary.errors}
              />
            </section>

            <section className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">Results</h2>
                <p className="font-mono text-xs text-zinc-500">{report.scanId}</p>
              </div>
              {report.results.length ? (
                report.results.map((result) => (
                  <ResultRow key={result.audioUrl} result={result} />
                ))
              ) : (
                <p className="rounded-md border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-400">
                  No audio files were discovered.
                </p>
              )}
            </section>

            {proofResults.length ? (
              <section className="grid gap-3 rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-5">
                <h2 className="text-xl font-semibold text-emerald-100">
                  SonoSig proofs found
                </h2>
                {proofResults.map((result) => (
                  <ResultRow key={`verified-${result.audioUrl}`} result={result} />
                ))}
              </section>
            ) : null}

            <section className="rounded-lg border border-white/10 bg-zinc-950 p-5">
              <h2 className="text-lg font-semibold text-white">Markdown report</h2>
              <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/40 p-4 text-xs leading-6 text-zinc-300">
                {report.markdown}
              </pre>
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}

function Checkbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300">
      <input
        checked={checked}
        className="h-4 w-4 accent-cyan-300"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function MetricCard({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "error" | "neutral" | "ok";
  value: number;
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
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

function ResultRow({ result }: { result: ScanResult }) {
  const statusClass = result.status.startsWith("sonosig_")
    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
    : result.status === "skipped"
      ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
      : "border-white/10 bg-zinc-950/60 text-zinc-300";

  return (
    <article className="grid min-w-0 gap-3 rounded-md border border-white/10 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-sm text-zinc-100">
            {result.audioUrl}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {result.detail ?? result.errors?.[0] ?? "No detail."}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusClass}`}
        >
          {result.status.replaceAll("_", " ")}
        </span>
      </div>
      {result.proof ? (
        <div className="grid gap-2 rounded-md border border-white/10 bg-black/30 p-3 text-xs text-zinc-400 md:grid-cols-2">
          <Info label="Wallet" value={result.proof.wallet} />
          <Info label="ENS" value={result.proof.ens} />
          <Info label="Audio hash" value={result.proof.audioHash} />
          <Info label="Issued" value={result.proof.issuedAt} />
        </div>
      ) : null}
    </article>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <p className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <span className="break-all font-mono text-zinc-300">
        {value ?? "Not recorded"}
      </span>
    </p>
  );
}
