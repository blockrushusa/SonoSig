import { AdminGate } from "@/components/admin-gate";
import { AdminUserManagement } from "@/components/admin-user-management";
import { SiteHeader } from "@/components/site-header";

export default function AdminUserManagementPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AdminGate>
        <AdminUserManagement />
      </AdminGate>
    </main>
  );
}
