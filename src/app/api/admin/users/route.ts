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
  role: UserRole;
};

type UpdateUserAccessBody = {
  admin?: unknown;
  email?: unknown;
  role?: unknown;
  uid?: unknown;
};

type UserRole = "admin" | "new" | "verified";

const USER_ROLES = new Set<UserRole>(["admin", "new", "verified"]);

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
    decodedToken.admin === true ||
    decodedToken.role === "admin" ||
    isBootstrapAdminEmail(decodedToken.email);

  return isAdmin ? decodedToken : null;
}

async function ensureBootstrapAdmins() {
  await Promise.all(
    BOOTSTRAP_ADMIN_EMAILS.map(async (email) => {
      try {
        const user = await adminAuth.getUserByEmail(email);
        const claims = user.customClaims ?? {};

        if (claims.admin !== true || claims.role !== "admin") {
          await adminAuth.setCustomUserClaims(user.uid, {
            ...claims,
            admin: true,
            role: "admin",
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
  const role = getUserRole(user.customClaims, isBootstrapAdmin);

  return {
    uid: user.uid,
    email,
    displayName: user.displayName ?? null,
    disabled: user.disabled,
    isAdmin: role === "admin",
    isBootstrapAdmin,
    role,
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
  const roleValue = body.role;
  const adminValue = body.admin;
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  let nextRole: UserRole;

  if (typeof roleValue === "string") {
    if (!isUserRole(roleValue)) {
      return jsonError("`role` must be new, verified, or admin.", 400);
    }

    nextRole = roleValue;
  } else if (typeof adminValue === "boolean") {
    nextRole = adminValue ? "admin" : "new";
  } else {
    return jsonError("Provide `role` or `admin`.", 400);
  }

  if (!uid && !email) {
    return jsonError("Provide a user uid or email.", 400);
  }

  const user = uid
    ? await adminAuth.getUser(uid)
    : await adminAuth.getUserByEmail(email);
  const userEmail = user.email ?? null;

  if (isBootstrapAdminEmail(userEmail) && nextRole !== "admin") {
    return jsonError("The bootstrap admin cannot be downgraded.", 400);
  }

  const nextClaims = { ...(user.customClaims ?? {}) };
  nextClaims.role = nextRole;

  if (nextRole === "admin") {
    nextClaims.admin = true;
  } else {
    delete nextClaims.admin;
  }

  await adminAuth.setCustomUserClaims(user.uid, nextClaims);

  const updatedUser = await adminAuth.getUser(user.uid);

  return Response.json({ user: toUserRow(updatedUser) });
}

function getUserRole(
  claims: Record<string, unknown> | undefined,
  isBootstrapAdmin: boolean,
): UserRole {
  if (isBootstrapAdmin || claims?.admin === true || claims?.role === "admin") {
    return "admin";
  }

  if (claims?.role === "verified") {
    return "verified";
  }

  return "new";
}

function isUserRole(value: string): value is UserRole {
  return USER_ROLES.has(value as UserRole);
}
