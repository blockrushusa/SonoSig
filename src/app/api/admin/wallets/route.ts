import { jsonError, requireAdmin } from "@/lib/admin-api";
import { getAdminWallets } from "@/lib/admin-wallet-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return jsonError("Admin access required.", 403);
    }

    const wallets = await getAdminWallets();

    return Response.json({
      generatedAt: new Date().toISOString(),
      wallets: wallets.filter(
        (wallet) => wallet.privateKeyConfigured || wallet.configuredPublicAddress,
      ),
    });
  } catch (error) {
    console.error("[admin-wallets] Unable to build wallet status.", error);

    return jsonError("Unable to load admin wallet status.", 500);
  }
}
