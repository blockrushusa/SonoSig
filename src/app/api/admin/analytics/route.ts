import {
  Timestamp,
  type CollectionReference,
  type Query,
} from "firebase-admin/firestore";
import { jsonError, requireAdmin } from "@/lib/admin-api";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isBootstrapAdminEmail } from "@/lib/admin-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RoleCounts = {
  admin: number;
  new: number;
  verified: number;
};

type ProofCounts = {
  draft: number;
  recent7Days: number;
  total: number;
};

export async function GET(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return jsonError("Admin access required.", 403);
  }

  const [users, proofs] = await Promise.all([getUserAnalytics(), getProofAnalytics()]);

  return Response.json({
    generatedAt: new Date().toISOString(),
    proofs,
    users,
  });
}

async function getUserAnalytics() {
  const users = await adminAuth.listUsers(1000);
  const roles: RoleCounts = { admin: 0, new: 0, verified: 0 };
  let disabled = 0;
  let emailVerified = 0;

  for (const user of users.users) {
    const role = getUserRole(user.customClaims, isBootstrapAdminEmail(user.email));
    roles[role] += 1;

    if (user.disabled) {
      disabled += 1;
    }

    if (user.emailVerified) {
      emailVerified += 1;
    }
  }

  return {
    disabled,
    emailVerified,
    roleSeries: [
      { label: "New", value: roles.new },
      { label: "Verified", value: roles.verified },
      { label: "Admin", value: roles.admin },
    ],
    total: users.users.length,
  };
}

async function getProofAnalytics(): Promise<ProofCounts> {
  try {
    const sevenDaysAgo = Timestamp.fromDate(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );
    const [total, draft, recent7Days] = await Promise.all([
      countQuery(adminDb.collection("audioProofs")),
      countQuery(adminDb.collection("audioProofs").where("status", "==", "draft")),
      countQuery(
        adminDb.collection("audioProofs").where("createdAt", ">=", sevenDaysAgo),
      ),
    ]);

    return { draft, recent7Days, total };
  } catch {
    return { draft: 0, recent7Days: 0, total: 0 };
  }
}

async function countQuery(query: CollectionReference | Query) {
  const snapshot = await query.count().get();

  return snapshot.data().count;
}

function getUserRole(
  claims: Record<string, unknown> | undefined,
  isBootstrapAdmin: boolean,
): keyof RoleCounts {
  if (isBootstrapAdmin || claims?.admin === true || claims?.role === "admin") {
    return "admin";
  }

  if (claims?.role === "verified") {
    return "verified";
  }

  return "new";
}
