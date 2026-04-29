import { adminDb } from "@/lib/firebase/admin";
import {
  coerceSiteSettings,
  DEFAULT_SITE_SETTINGS,
} from "@/lib/site-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SETTINGS_DOC = adminDb.collection("siteSettings").doc("public");

export async function GET() {
  try {
    const snapshot = await SETTINGS_DOC.get();
    const settings = snapshot.exists
      ? coerceSiteSettings(snapshot.data())
      : DEFAULT_SITE_SETTINGS;

    return Response.json({ settings });
  } catch {
    return Response.json({ settings: DEFAULT_SITE_SETTINGS });
  }
}
