import "server-only";

import { isBootstrapAdminEmail } from "@/lib/admin-access";
import { adminAuth } from "@/lib/firebase/admin";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return null;
  }

  let decodedToken: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;

  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }

  const isAdmin =
    decodedToken.admin === true ||
    decodedToken.role === "admin" ||
    isBootstrapAdminEmail(decodedToken.email);

  return isAdmin ? decodedToken : null;
}
