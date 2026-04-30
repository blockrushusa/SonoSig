import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export const PACSTAC_API_MODES = ["api-key", "x402"] as const;

export type PacStacApiMode = (typeof PACSTAC_API_MODES)[number];

export type AdminApiConfig = {
  pacstacApiMode: PacStacApiMode;
};

export const DEFAULT_ADMIN_API_CONFIG: AdminApiConfig = {
  pacstacApiMode: "api-key",
};

const API_CONFIG_REF = adminDb.collection("adminSettings").doc("apiConfig");

export function isPacStacApiMode(value: unknown): value is PacStacApiMode {
  return (
    typeof value === "string" &&
    PACSTAC_API_MODES.includes(value as PacStacApiMode)
  );
}

export async function getAdminApiConfig(): Promise<AdminApiConfig> {
  const snapshot = await API_CONFIG_REF.get();

  if (!snapshot.exists) {
    return DEFAULT_ADMIN_API_CONFIG;
  }

  const data = snapshot.data() ?? {};

  return {
    pacstacApiMode: isPacStacApiMode(data.pacstacApiMode)
      ? data.pacstacApiMode
      : DEFAULT_ADMIN_API_CONFIG.pacstacApiMode,
  };
}

export async function saveAdminApiConfig(
  config: AdminApiConfig,
  updatedBy: string | undefined,
) {
  await API_CONFIG_REF.set(
    {
      ...config,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: updatedBy ?? null,
    },
    { merge: true },
  );

  return config;
}
