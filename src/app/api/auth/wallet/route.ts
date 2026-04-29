import { verifyMessage } from "viem";
import { adminAuth } from "@/lib/firebase/admin";
import {
  buildWalletLoginMessage,
  getWalletDisplayName,
  getWalletLoginUid,
  parseWalletLoginMessage,
} from "@/lib/wallet-auth";

export const runtime = "nodejs";

type WalletLoginBody = {
  address?: unknown;
  message?: unknown;
  signature?: unknown;
};

const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  let body: WalletLoginBody;

  try {
    body = (await request.json()) as WalletLoginBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const address = typeof body.address === "string" ? body.address : "";
  const message = typeof body.message === "string" ? body.message : "";
  const signature = typeof body.signature === "string" ? body.signature : "";

  if (!address || !message || !signature) {
    return jsonError("Provide address, message, and signature.", 400);
  }

  try {
    const parsed = parseWalletLoginMessage(message);
    const expectedMessage = buildWalletLoginMessage(parsed);
    const requestHost = getRequestHost(request);

    if (expectedMessage !== message) {
      return jsonError("Wallet login message was modified.", 400);
    }

    if (requestHost && parsed.domain !== requestHost) {
      return jsonError("Wallet login domain does not match this site.", 400);
    }

    if (new URL(parsed.uri).host !== parsed.domain) {
      return jsonError("Wallet login URI does not match signed domain.", 400);
    }

    if (parsed.address.toLowerCase() !== address.toLowerCase()) {
      return jsonError("Wallet address does not match signed message.", 400);
    }

    const issuedAtMs = Date.parse(parsed.issuedAt);

    if (
      !Number.isFinite(issuedAtMs) ||
      issuedAtMs > Date.now() + 60_000 ||
      Date.now() - issuedAtMs > MAX_MESSAGE_AGE_MS
    ) {
      return jsonError("Wallet login message expired. Try again.", 400);
    }

    const isValid = await verifyMessage({
      address: parsed.address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return jsonError("Wallet signature could not be verified.", 401);
    }

    const uid = getWalletLoginUid(parsed.address);
    const user = await ensureWalletUser(uid, parsed.address);
    const token = await adminAuth.createCustomToken(user.uid, {
      role: getRoleClaim(user.customClaims),
      walletAddress: parsed.address,
    });

    return Response.json({
      token,
      uid: user.uid,
      wallet: parsed.address,
    });
  } catch (error) {
    console.error("[wallet-auth] Unable to sign in with wallet.", error);

    return jsonError(getWalletAuthErrorMessage(error), 400);
  }
}

async function ensureWalletUser(uid: string, address: string) {
  try {
    const user = await adminAuth.getUser(uid);
    const claims = user.customClaims ?? {};
    const nextClaims = {
      ...claims,
      role: typeof claims.role === "string" ? claims.role : "new",
      walletAddress: address,
    };

    await Promise.all([
      user.displayName
        ? Promise.resolve()
        : adminAuth.updateUser(uid, { displayName: getWalletDisplayName(address) }),
      adminAuth.setCustomUserClaims(uid, nextClaims),
    ]);

    return adminAuth.getUser(uid);
  } catch (error) {
    if (!isUserNotFoundError(error)) {
      throw error;
    }

    await adminAuth.createUser({
      uid,
      displayName: getWalletDisplayName(address),
    });
    await adminAuth.setCustomUserClaims(uid, {
      role: "new",
      walletAddress: address,
    });

    return adminAuth.getUser(uid);
  }
}

function getRoleClaim(claims: Record<string, unknown> | undefined) {
  return typeof claims?.role === "string" ? claims.role : "new";
}

function isUserNotFoundError(error: unknown) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "auth/user-not-found"
  );
}

function getRequestHost(request: Request) {
  return (
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    ""
  );
}

function getWalletAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("Failed to determine service account") ||
    message.includes("metadata")
  ) {
    return "Wallet login needs a Firebase service account signer. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_ADMIN_SERVICE_ACCOUNT_ID in the server environment.";
  }

  return message || "Wallet sign-in failed.";
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
