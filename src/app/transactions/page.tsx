import { AuthGate } from "@/components/auth-gate";
import { SiteHeader } from "@/components/site-header";
import { UserTransactions } from "@/components/user-transactions";

export default function TransactionsPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AuthGate>
        <UserTransactions />
      </AuthGate>
    </main>
  );
}
