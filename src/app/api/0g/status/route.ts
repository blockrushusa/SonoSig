import { getAdminApiConfig } from "@/lib/admin-api-config";
import { getZeroGStorageStatus } from "@/lib/zero-g-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const config = await getAdminApiConfig();
  const status = getZeroGStorageStatus();

  return Response.json({
    ...status,
    enabled: config.zeroGStorageEnabled,
  });
}
