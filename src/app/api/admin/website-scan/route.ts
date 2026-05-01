import { jsonError, requireAdmin } from "@/lib/admin-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebsiteScanRequest = {
  allowPrivateHosts?: boolean;
  allowedDomains?: string[];
  followExternalPageLinks?: boolean;
  headless?: boolean;
  includeExternalAudio?: boolean;
  keepDownloads?: boolean;
  maxAudioBytes?: number;
  maxDepth?: number;
  maxPages?: number;
  rateLimitMs?: number;
  respectRobots?: boolean;
  url?: string;
};

type WebsiteScannerModule = {
  scanWebsite: (input: WebsiteScanRequest) => Promise<unknown>;
};

export async function POST(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return jsonError("Admin access required.", 403);
  }

  let body: WebsiteScanRequest;

  try {
    body = (await request.json()) as WebsiteScanRequest;
  } catch {
    return jsonError("Invalid scanner request.", 400);
  }

  if (!body.url || typeof body.url !== "string") {
    return jsonError("Website URL is required.", 400);
  }

  const scanner = (await import(
    "../../../../../scripts/sonosig-website-scanner.mjs"
  )) as WebsiteScannerModule;

  try {
    const report = await scanner.scanWebsite({
      allowPrivateHosts: body.allowPrivateHosts === true,
      allowedDomains: Array.isArray(body.allowedDomains)
        ? body.allowedDomains
        : [],
      followExternalPageLinks: body.followExternalPageLinks === true,
      headless: body.headless === true,
      includeExternalAudio: body.includeExternalAudio !== false,
      keepDownloads: false,
      maxAudioBytes: clampNumber(body.maxAudioBytes, 1_000_000, 100_000_000),
      maxDepth: clampNumber(body.maxDepth, 0, 4),
      maxPages: clampNumber(body.maxPages, 1, 100),
      rateLimitMs: clampNumber(body.rateLimitMs, 0, 5_000),
      respectRobots: body.respectRobots !== false,
      url: body.url,
    });

    return Response.json(report);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Website scan failed.",
      500,
    );
  }
}

function clampNumber(
  value: number | undefined,
  minimum: number,
  maximum: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(minimum, Math.min(maximum, value));
}
