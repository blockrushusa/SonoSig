import { AuthGate } from "@/components/auth-gate";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function DashboardPage() {
  return (
    <AuthGate>
      <PlaceholderPage
        description="This page will become the authenticated workspace for managing audio proofs, wallets, and verification history."
        eyebrow="Dashboard"
        title="Dashboard"
      />
    </AuthGate>
  );
}
