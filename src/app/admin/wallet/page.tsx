import { AdminGate } from "@/components/admin-gate";
import { AdminWallets } from "@/components/admin-wallets";
import { SiteHeader } from "@/components/site-header";

export default function AdminWalletPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AdminGate>
        <AdminWallets />
      </AdminGate>
    </main>
  );
}
