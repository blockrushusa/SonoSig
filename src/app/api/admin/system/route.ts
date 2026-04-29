import { existsSync } from "node:fs";
import { join } from "node:path";
import { jsonError, requireAdmin } from "@/lib/admin-api";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SystemCheck = {
  detail: string;
  label: string;
  status: "ok" | "warn" | "error";
};

export async function GET(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return jsonError("Admin access required.", 403);
  }

  const checks = await Promise.all([
    checkFirebaseAuth(),
    checkFirestore(),
    checkEnvironment("PACSTAC_API_KEY", "PacStac API key"),
    checkEnvironment("EVM_MULTI_CHAIN_RPC_URL", "Base / multi-chain RPC"),
    checkEnvironment("ETHEREUM_RPC_URL", "Ethereum RPC", true),
    checkEnvironment("ENS_SUBGRAPH_URL", "ENS subgraph", true),
    checkEnvironment("BASE_X402_WALLET_PRIVATE_KEY", "Base x402 wallet"),
    checkEnvironment("BASE_X402_WALLET_PUBLIC_KEY", "Base x402 public address"),
    checkEnvironment("SONOSIG_ENS_PRIVATE_KEY", "ENS writer wallet", true),
    checkSiteSettings(),
    checkMcpScript(),
  ]);

  return Response.json({
    generatedAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      uptimeSeconds: Math.round(process.uptime()),
    },
    checks,
  });
}

async function checkFirebaseAuth(): Promise<SystemCheck> {
  try {
    await adminAuth.listUsers(1);

    return {
      detail: "Firebase Admin Auth responded.",
      label: "Firebase Auth",
      status: "ok",
    };
  } catch {
    return {
      detail: "Firebase Admin Auth is not responding from this runtime.",
      label: "Firebase Auth",
      status: "error",
    };
  }
}

async function checkFirestore(): Promise<SystemCheck> {
  try {
    await adminDb.collection("audioProofs").limit(1).get();

    return {
      detail: "Firestore responded for the audioProofs collection.",
      label: "Firestore",
      status: "ok",
    };
  } catch {
    return {
      detail: "Firestore is not responding from this runtime.",
      label: "Firestore",
      status: "error",
    };
  }
}

async function checkSiteSettings(): Promise<SystemCheck> {
  try {
    await adminDb.collection("siteSettings").doc("public").get();

    return {
      detail: "Site settings can be read from Firestore.",
      label: "Site settings",
      status: "ok",
    };
  } catch {
    return {
      detail: "Site settings could not be read from Firestore.",
      label: "Site settings",
      status: "error",
    };
  }
}

async function checkEnvironment(
  envName: string,
  label: string,
  optional = false,
): Promise<SystemCheck> {
  const isConfigured = Boolean(process.env[envName]?.trim());

  if (isConfigured) {
    return {
      detail: `${envName} is configured.`,
      label,
      status: "ok",
    };
  }

  return {
    detail: optional
      ? `${envName} is optional and not configured.`
      : `${envName} is required for this capability and is not configured.`,
    label,
    status: optional ? "warn" : "error",
  };
}

async function checkMcpScript(): Promise<SystemCheck> {
  const scriptPath = join(process.cwd(), "scripts", "sonosig-mcp-server.mjs");
  const isPresent = existsSync(scriptPath);

  return {
    detail: isPresent
      ? "scripts/sonosig-mcp-server.mjs is present."
      : "scripts/sonosig-mcp-server.mjs is missing.",
    label: "MCP server script",
    status: isPresent ? "ok" : "error",
  };
}
