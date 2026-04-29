import { DeveloperMcpPanel } from "@/components/developer-mcp-panel";
import { SiteHeader } from "@/components/site-header";

export default function DeveloperMcpPage() {
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
              MCP server.
            </h1>
          </section>

          <DeveloperMcpPanel />
        </div>
      </section>
    </main>
  );
}
