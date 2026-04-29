import { DeveloperMcpPanel } from "@/components/developer-mcp-panel";
import { SiteHeader } from "@/components/site-header";

export default function DeveloperPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <section className="px-6 py-12 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-6">
          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/30">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Developer
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
              SonoSig agent integration.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
              Use the local MCP server to let AI agents encode signed proofs,
              verify embedded proofs, register PacStac claims, and prepare or
              submit ENS records from a controlled development environment.
            </p>
          </section>

          <DeveloperMcpPanel />
        </div>
      </section>
    </main>
  );
}
