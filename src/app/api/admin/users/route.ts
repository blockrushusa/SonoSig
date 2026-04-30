import { jsonError, requireAdmin } from "@/lib/admin-api";
import {
  BOOTSTRAP_ADMIN_EMAILS,
  isBootstrapAdminEmail,
} from "@/lib/admin-access";
import { adminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";

type UserRow = {
  uid: string;
  email: string | null;
  createdAt: string | null;
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
    createdAt: user.metadata.creationTime ?? null,
    displayName: user.displayName ?? null,
    disabled: user.disabled,
    isAdmin: role === "admin",
    isBootstrapAdmin,
    role,
  };
}

export async function GET(request: Request) {
  try {
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
  } catch (error) {
    console.error("[admin-users] Unable to list users.", error);

    return jsonError("Unable to load site users.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return jsonError("Admin access required.", 403);
    }

    await ensureBootstrapAdmins();

    let body: UpdateUserAccessBody;

    try {
      body = (await request.json()) as UpdateUserAccessBody;
    } catch {
      return jsonError("Request body must be valid JSON.", 400);
    }

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
  } catch (error) {
    console.error("[admin-users] Unable to update user role.", error);

    return jsonError(getAdminUserErrorMessage(error), getAdminUserErrorStatus(error));
  }
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

function getAdminUserErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "auth/user-not-found"
  ) {
    return "No Firebase user exists for that email.";
  }

  return "Unable to update user role.";
}

function getAdminUserErrorStatus(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "auth/user-not-found"
  ) {
    return 404;
  }

  return 500;
}
