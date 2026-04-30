import { jsonError, requireAdmin } from "@/lib/admin-api";
import {
  getAdminApiConfig,
  isPacStacApiMode,
  saveAdminApiConfig,
  type AdminApiConfig,
} from "@/lib/admin-api-config";
import { getAdminWalletById } from "@/lib/admin-wallet-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UpdateApiConfigBody = Partial<AdminApiConfig>;

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return jsonError("Admin access required.", 403);
    }

    return Response.json(await buildApiConfigResponse());
  } catch (error) {
    console.error("[admin-api-config] Unable to load API config.", error);

    return jsonError("Unable to load API config.", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return jsonError("Admin access required.", 403);
    }

    let body: UpdateApiConfigBody;

    try {
      body = (await request.json()) as UpdateApiConfigBody;
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    if (!isPacStacApiMode(body.pacstacApiMode)) {
      return jsonError("Choose a valid PacStac API mode.", 400);
    }

    await saveAdminApiConfig(
      { pacstacApiMode: body.pacstacApiMode },
      admin.email,
    );

    return Response.json(await buildApiConfigResponse());
  } catch (error) {
    console.error("[admin-api-config] Unable to save API config.", error);

    return jsonError("Unable to save API config.", 500);
  }
}

async function buildApiConfigResponse() {
  const [config, baseX402Wallet] = await Promise.all([
    getAdminApiConfig(),
    getAdminWalletById("base-x402"),
  ]);

  return {
    capabilities: {
      pacstacApiKeyConfigured: Boolean(process.env.PACSTAC_API_KEY?.trim()),
      x402WalletConfigured: Boolean(baseX402Wallet?.privateKeyConfigured),
    },
    config,
    generatedAt: new Date().toISOString(),
    wallets: {
      baseX402: baseX402Wallet,
    },
  };
}
