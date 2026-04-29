import { AuthGate } from "@/components/auth-gate";
import { EnsToolsStudio } from "@/components/ens-tools-studio";
import { SiteHeader } from "@/components/site-header";

export default function ToolsPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AuthGate>
        <section className="px-6 py-12 lg:px-16">
          <EnsToolsStudio />
        </section>
      </AuthGate>
    </main>
  );
}
