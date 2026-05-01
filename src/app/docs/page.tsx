import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

export default function DocsPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-10">
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Docs
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              SonoSig developer documentation.
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-300">
              Technical references for encoding audio proofs, publishing ENS
              discovery pointers, verifying claims, and integrating SonoSig with
              PacStac-aware workflows.
            </p>
          </div>

          <section className="grid gap-5 md:grid-cols-2">
            <DocsCard
              eyebrow="Encoding"
              href="/docs/encoding"
              title="SONOSIG1 audio proof format"
            >
              Learn how SonoSig builds wallet-signed audio proofs, embeds the
              SONOSIG1 payload into exported files, and verifies the proof later.
            </DocsCard>
            <DocsCard
              eyebrow="Identity"
              href="/docs/ens"
              title="ENS and PacStac discovery"
            >
              Review how SonoSig uses ENS text records to point agents and apps
              to a creator-controlled PacStac wallet collection.
            </DocsCard>
            <DocsCard
              eyebrow="Agents"
              href="/developer/mcp"
              title="MCP server guide"
            >
              Use the SonoSig MCP server from compatible agents to verify files,
              inspect proofs, and publish discovery pointers.
            </DocsCard>
            <DocsCard
              eyebrow="Scanning"
              href="/website-scanner"
              title="Agentic Scan"
            >
              Scan a website page for audio files that carry embedded SonoSig
              proofs and review the verification report.
            </DocsCard>
          </section>
        </div>
      </section>
    </main>
  );
}

function DocsCard({
  children,
  eyebrow,
  href,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  href: string;
  title: string;
}) {
  return (
    <Link
      className="group rounded-lg border border-white/10 bg-white/[0.04] p-6 transition hover:border-cyan-300/40 hover:bg-cyan-300/5"
      href={href}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-4 text-sm leading-6 text-zinc-300">{children}</p>
      <p className="mt-6 text-sm font-semibold text-cyan-200 transition group-hover:text-cyan-100">
        Open docs
      </p>
    </Link>
  );
}
