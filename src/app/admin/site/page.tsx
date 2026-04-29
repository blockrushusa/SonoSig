import { AdminGate } from "@/components/admin-gate";
import { AdminSiteSettings } from "@/components/admin-site-settings";
import { SiteHeader } from "@/components/site-header";

export default function AdminSitePage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AdminGate>
        <AdminSiteSettings />
      </AdminGate>
    </main>
  );
}
