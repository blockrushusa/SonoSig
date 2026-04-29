import { AuthGate } from "@/components/auth-gate";
import { ProfilePanel } from "@/components/profile-panel";
import { SiteHeader } from "@/components/site-header";

export default function ProfilePage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0e1116] text-zinc-50">
      <SiteHeader />
      <AuthGate>
        <ProfilePanel />
      </AuthGate>
    </main>
  );
}
