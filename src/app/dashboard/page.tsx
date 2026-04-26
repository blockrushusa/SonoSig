import { AuthGate } from "@/components/auth-gate";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { SiteHeader } from "@/components/site-header";

export default function DashboardPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AuthGate>
        <DashboardWorkspace />
      </AuthGate>
    </main>
  );
}
