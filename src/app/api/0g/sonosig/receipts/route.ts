import { getAdminApiConfig } from "@/lib/admin-api-config";
import type { ProofPayload } from "@/lib/audio-watermark";
import {
  isZeroGStorageConfigured,
  uploadSonoSigReceiptToZeroG,
} from "@/lib/zero-g-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ZeroGReceiptRequest = {
  proof?: ProofPayload;
  registration?: Record<string, unknown>;
};

export async function POST(request: Request) {
  let body: ZeroGReceiptRequest;

  try {
    body = (await request.json()) as ZeroGReceiptRequest;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  if (!body.proof?.audio_hash || !body.proof?.wallet || !body.proof.signature) {
    return jsonError("A valid SonoSig proof is required.", 400);
  }

  const config = await getAdminApiConfig();

  if (!config.zeroGStorageEnabled) {
    return jsonError("0G Storage is not enabled for SonoSig receipts.", 400);
  }

  if (!isZeroGStorageConfigured()) {
    return jsonError("0G Storage is enabled but not configured.", 500);
  }

  try {
    const receipt = await uploadSonoSigReceiptToZeroG({
      generatedAt: new Date().toISOString(),
      proof: body.proof,
      registration: body.registration ?? {},
      source: "sonosig-web",
    });

    return Response.json(receipt);
  } catch (error) {
    console.error("[zero-g-receipts] Unable to upload receipt.", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to upload SonoSig receipt to 0G Storage.",
      502,
    );
  }
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
