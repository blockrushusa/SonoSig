import { AdminAnalytics } from "@/components/admin-analytics";
import { AdminGate } from "@/components/admin-gate";
import { SiteHeader } from "@/components/site-header";

export default function AdminAnalyticsPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AdminGate>
        <AdminAnalytics />
      </AdminGate>
    </main>
  );
}
