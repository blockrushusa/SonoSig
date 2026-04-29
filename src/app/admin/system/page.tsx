import { AdminGate } from "@/components/admin-gate";
import { AdminSystemStatus } from "@/components/admin-system-status";
import { SiteHeader } from "@/components/site-header";

export default function AdminSystemPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AdminGate>
        <AdminSystemStatus />
      </AdminGate>
    </main>
  );
}
