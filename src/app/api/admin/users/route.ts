import { adminAuth } from "@/lib/firebase/admin";
import {
  BOOTSTRAP_ADMIN_EMAILS,
  isBootstrapAdminEmail,
} from "@/lib/admin-access";

export const runtime = "nodejs";

type UserRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  isAdmin: boolean;
  isBootstrapAdmin: boolean;
};

type UpdateUserAccessBody = {
  admin?: unknown;
  email?: unknown;
  uid?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return null;
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const isAdmin =
    decodedToken.admin === true || isBootstrapAdminEmail(decodedToken.email);

  return isAdmin ? decodedToken : null;
}

async function ensureBootstrapAdmins() {
  await Promise.all(
    BOOTSTRAP_ADMIN_EMAILS.map(async (email) => {
      try {
        const user = await adminAuth.getUserByEmail(email);
        const claims = user.customClaims ?? {};

        if (claims.admin !== true) {
          await adminAuth.setCustomUserClaims(user.uid, {
            ...claims,
            admin: true,
          });
        }
      } catch {
        // The bootstrap user may not exist in this Firebase project yet.
      }
    }),
  );
}

function toUserRow(user: Awaited<ReturnType<typeof adminAuth.listUsers>>["users"][number]): UserRow {
  const email = user.email ?? null;
  const isBootstrapAdmin = isBootstrapAdminEmail(email);

  return {
    uid: user.uid,
    email,
    displayName: user.displayName ?? null,
    disabled: user.disabled,
    isAdmin: user.customClaims?.admin === true || isBootstrapAdmin,
    isBootstrapAdmin,
  };
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return jsonError("Admin access required.", 403);
  }

  await ensureBootstrapAdmins();

  const users = await adminAuth.listUsers(1000);

  return Response.json({
    users: users.users.map(toUserRow).sort((a, b) => {
      const aLabel = a.email ?? a.displayName ?? a.uid;
      const bLabel = b.email ?? b.displayName ?? b.uid;

      return aLabel.localeCompare(bLabel);
    }),
  });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return jsonError("Admin access required.", 403);
  }

  await ensureBootstrapAdmins();

  const body = (await request.json()) as UpdateUserAccessBody;
  const adminValue = body.admin;
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (typeof adminValue !== "boolean") {
    return jsonError("`admin` must be true or false.", 400);
  }

  if (!uid && !email) {
    return jsonError("Provide a user uid or email.", 400);
  }

  const user = uid
    ? await adminAuth.getUser(uid)
    : await adminAuth.getUserByEmail(email);
  const userEmail = user.email ?? null;

  if (isBootstrapAdminEmail(userEmail) && !adminValue) {
    return jsonError("The bootstrap admin cannot be downgraded.", 400);
  }

  const nextClaims = { ...(user.customClaims ?? {}) };

  if (adminValue) {
    nextClaims.admin = true;
  } else {
    delete nextClaims.admin;
  }

  await adminAuth.setCustomUserClaims(user.uid, nextClaims);

  const updatedUser = await adminAuth.getUser(user.uid);

  return Response.json({ user: toUserRow(updatedUser) });
}
