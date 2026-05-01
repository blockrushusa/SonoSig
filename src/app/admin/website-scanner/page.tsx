import { AdminGate } from "@/components/admin-gate";
import { AdminWebsiteScanner } from "@/components/admin-website-scanner";
import { SiteHeader } from "@/components/site-header";

export default function AdminWebsiteScannerPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AdminGate>
        <AdminWebsiteScanner />
      </AdminGate>
    </main>
  );
}
