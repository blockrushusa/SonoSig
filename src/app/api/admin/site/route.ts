import { FieldValue } from "firebase-admin/firestore";
import { jsonError, requireAdmin } from "@/lib/admin-api";
import { adminDb } from "@/lib/firebase/admin";
import {
  coerceSiteSettings,
  DEFAULT_SITE_SETTINGS,
} from "@/lib/site-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SETTINGS_DOC = adminDb.collection("siteSettings").doc("public");

export async function GET(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return jsonError("Admin access required.", 403);
  }

  const snapshot = await SETTINGS_DOC.get();
  const settings = snapshot.exists
    ? coerceSiteSettings(snapshot.data())
    : DEFAULT_SITE_SETTINGS;

  return Response.json({
    generatedAt: new Date().toISOString(),
    settings,
  });
}

export async function PUT(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return jsonError("Admin access required.", 403);
  }

  const body = (await request.json()) as unknown;
  const settings = coerceSiteSettings(body);

  await SETTINGS_DOC.set(
    {
      ...settings,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.email ?? admin.uid,
    },
    { merge: true },
  );

  return Response.json({
    generatedAt: new Date().toISOString(),
    settings,
  });
}
