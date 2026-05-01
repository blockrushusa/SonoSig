import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPublicClient, http } from "viem";

const MAGIC = "SONOSIG1";
const HEADER_BYTES = MAGIC.length + 4;
const DEFAULT_USER_AGENT = "SonoSigWebsiteScanner/1.0 (+https://sonosig.com)";
const DEFAULT_MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_PAGES = 50;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_RATE_LIMIT_MS = 500;
const DEFAULT_TIMEOUT_MS = 15_000;
const AUDIO_EXTENSIONS = new Set([
  ".aif",
  ".aiff",
  ".flac",
  ".m4a",
  ".mp3",
  ".oga",
  ".ogg",
  ".opus",
  ".wav",
]);
const AUDIO_CONTENT_TYPES = [
  "audio/",
  "application/ogg",
  "application/octet-stream",
  "application/x-mpegurl",
  "application/vnd.apple.mpegurl",
];
const DEFAULT_SITEMAP_PATHS = ["/sitemap.xml", "/sitemap_index.xml"];
const DEFAULT_FEED_PATHS = ["/feed", "/feed.xml", "/rss", "/rss.xml", "/atom.xml"];
const PRIVATE_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const ETHEREUM_MAINNET = {
  id: 1,
  name: "Ethereum",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: ["https://cloudflare-eth.com"] } },
};

export const DEFAULT_SCAN_OPTIONS = {
  allowPrivateHosts: false,
  followExternalPageLinks: false,
  includeExternalAudio: true,
  keepDownloads: false,
  maxAudioBytes: DEFAULT_MAX_AUDIO_BYTES,
  maxDepth: DEFAULT_MAX_DEPTH,
  maxPages: DEFAULT_MAX_PAGES,
  rateLimitMs: DEFAULT_RATE_LIMIT_MS,
  respectRobots: true,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  userAgent: DEFAULT_USER_AGENT,
};

export async function scanWebsite(inputOptions) {
  const startedAt = new Date().toISOString();
  const options = normalizeOptions(inputOptions);
  const rootUrl = normalizeHttpUrl(options.url);
  const scanId = createScanId(rootUrl);
  const tempDir =
    options.tempDir ?? join(process.cwd(), ".local", "website-scans", scanId);
  const pages = [];
  const discoveredAudioMap = new Map();
  const errors = [];
  const skipped = [];
  const advancedDiscovery = {
    feeds: [],
    headless: { attempted: Boolean(options.headless), used: false },
    manifests: [],
    robots: { respected: options.respectRobots, loaded: false },
    sitemaps: [],
  };

  await assertSafeUrl(rootUrl, options);
  await mkdir(tempDir, { recursive: true });

  const allowedPageHosts = new Set([
    rootUrl.hostname,
    ...(options.allowedDomains ?? []),
  ]);
  const allowedAudioHosts = options.includeExternalAudio
    ? null
    : new Set(allowedPageHosts);
  const robots = options.respectRobots
    ? await loadRobots(rootUrl, options, advancedDiscovery)
    : createAllowAllRobots();

  const queue = [{ depth: 0, source: "root", url: rootUrl.href }];
  const visitedPages = new Set();
  const pageCandidates = new Set([rootUrl.href]);

  for (const sitemapUrl of await discoverSitemapPages(rootUrl, options, advancedDiscovery)) {
    enqueuePage(queue, pageCandidates, sitemapUrl, 1, "sitemap", options, allowedPageHosts);
  }

  for (const feedUrl of await discoverFeedPages(rootUrl, options, advancedDiscovery)) {
    enqueuePage(queue, pageCandidates, feedUrl, 1, "feed", options, allowedPageHosts);
  }

  while (queue.length && pages.length < options.maxPages) {
    const next = queue.shift();

    if (!next || visitedPages.has(next.url) || next.depth > options.maxDepth) {
      continue;
    }

    visitedPages.add(next.url);

    let pageUrl;
    try {
      pageUrl = normalizeHttpUrl(next.url);
      await assertSafeUrl(pageUrl, options);
    } catch (error) {
      errors.push(scanError(next.url, "page_url_rejected", error));
      continue;
    }

    if (!isHostAllowed(pageUrl, allowedPageHosts, options.followExternalPageLinks)) {
      skipped.push({ reason: "page_host_not_allowed", url: pageUrl.href });
      continue;
    }

    if (!robots.isAllowed(pageUrl)) {
      skipped.push({ reason: "robots_disallowed", url: pageUrl.href });
      continue;
    }

    await delay(options.rateLimitMs);

    const pageRecord = {
      depth: next.depth,
      discoveredAudio: 0,
      discoveredLinks: 0,
      source: next.source,
      status: "pending",
      url: pageUrl.href,
    };
    pages.push(pageRecord);

    try {
      const page = await fetchText(pageUrl.href, options);
      const discoveries = discoverFromDocument(page.text, pageUrl.href);

      pageRecord.status = "scanned";
      pageRecord.title = discoveries.title;
      pageRecord.discoveredLinks = discoveries.pageLinks.length;
      pageRecord.discoveredAudio = discoveries.audio.length;

      collectAudio(discoveredAudioMap, discoveries.audio, pageUrl.href, allowedAudioHosts);

      for (const manifestUrl of discoveries.manifests) {
        await discoverManifestAudio(
          manifestUrl,
          pageUrl.href,
          options,
          discoveredAudioMap,
          advancedDiscovery,
          allowedAudioHosts,
        );
      }

      for (const feedUrl of discoveries.feeds) {
        const feedPages = await discoverFeedPages(
          normalizeHttpUrl(feedUrl),
          options,
          advancedDiscovery,
          { explicitFeedUrl: feedUrl },
        );
        for (const feedPage of feedPages) {
          enqueuePage(
            queue,
            pageCandidates,
            feedPage,
            next.depth + 1,
            "feed",
            options,
            allowedPageHosts,
          );
        }
      }

      if (options.headless) {
        const headlessAudio = await discoverHeadlessAudio(pageUrl.href, options, advancedDiscovery);
        collectAudio(discoveredAudioMap, headlessAudio, pageUrl.href, allowedAudioHosts);
      }

      for (const link of discoveries.pageLinks) {
        enqueuePage(
          queue,
          pageCandidates,
          link,
          next.depth + 1,
          "page",
          options,
          allowedPageHosts,
        );
      }
    } catch (error) {
      pageRecord.status = "failed";
      pageRecord.error = getErrorMessage(error);
      errors.push(scanError(pageUrl.href, "page_fetch_failed", error));
    }
  }

  const audio = Array.from(discoveredAudioMap.values());
  const results = [];

  for (const item of audio) {
    const result = await processAudioDiscovery(item, {
      options,
      tempDir,
    });
    results.push(result);
  }

  if (!options.keepDownloads) {
    await rm(tempDir, { force: true, recursive: true });
  }

  const finishedAt = new Date().toISOString();
  const report = {
    advancedDiscovery,
    audio,
    errors,
    finishedAt,
    options: publicOptions(options),
    pages,
    results,
    rootUrl: rootUrl.href,
    scanId,
    skipped,
    startedAt,
    summary: summarizeScan({ audio, errors, pages, results, skipped }),
  };

  report.markdown = generateMarkdownReport(report);

  return report;
}

export function generateMarkdownReport(report) {
  const lines = [
    "# SonoSig Website Audio Scan",
    "",
    `Root URL: ${report.rootUrl}`,
    `Scan ID: ${report.scanId}`,
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt}`,
    "",
    "## Summary",
    "",
    `- Pages scanned: ${report.summary.pagesScanned}`,
    `- Audio files discovered: ${report.summary.audioDiscovered}`,
    `- SonoSig verified: ${report.summary.sonosigVerified}`,
    `- SonoSig payload found but audio changed: ${report.summary.payloadChanged}`,
    `- SonoSig payload found, hash not checked: ${report.summary.payloadHashNotChecked}`,
    `- Not encoded: ${report.summary.notEncoded}`,
    `- Skipped: ${report.summary.skipped}`,
    `- Errors: ${report.summary.errors}`,
    "",
    "## Verified Files",
    "",
  ];

  const verified = report.results.filter((result) =>
    ["sonosig_verified", "sonosig_payload_found_hash_not_checked"].includes(
      result.status,
    ),
  );

  if (verified.length) {
    lines.push("| Audio URL | Wallet | ENS | Audio hash | Issued |");
    lines.push("|---|---|---|---|---|");
    for (const result of verified) {
      lines.push(
        `| ${escapeMd(result.audioUrl)} | ${escapeMd(result.proof?.wallet ?? "")} | ${escapeMd(result.proof?.ens ?? "")} | ${escapeMd(result.proof?.audioHash ?? "")} | ${escapeMd(result.proof?.issuedAt ?? "")} |`,
      );
    }
  } else {
    lines.push("No SonoSig-verified audio files were found.");
  }

  lines.push("", "## Audio Findings", "");
  if (report.results.length) {
    lines.push("| Status | Audio URL | Found on | Detail |");
    lines.push("|---|---|---|---|");
    for (const result of report.results) {
      lines.push(
        `| ${result.status} | ${escapeMd(result.audioUrl)} | ${escapeMd(result.foundOn?.[0] ?? "")} | ${escapeMd(result.detail ?? result.errors?.[0] ?? "")} |`,
      );
    }
  } else {
    lines.push("No audio files were discovered.");
  }

  if (report.errors.length) {
    lines.push("", "## Errors", "");
    for (const error of report.errors) {
      lines.push(`- ${error.code}: ${error.url} - ${error.message}`);
    }
  }

  if (report.skipped.length) {
    lines.push("", "## Skipped", "");
    for (const skipped of report.skipped) {
      lines.push(`- ${skipped.reason}: ${skipped.url}`);
    }
  }

  lines.push(
    "",
    "## Notes",
    "",
    "SonoSig verification is a technical provenance signal. It does not prove legal copyright ownership, authorship, or licensing rights.",
  );

  return `${lines.join("\n")}\n`;
}

export async function writeScanReports(report, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const jsonPath = join(outputDir, "scan-report.json");
  const markdownPath = join(outputDir, "scan-report.md");
  const { markdown, ...jsonReport } = report;

  await writeFile(jsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`);
  await writeFile(markdownPath, markdown);

  return { jsonPath, markdownPath };
}

export function compareScanReports(previous, current) {
  const previousByUrl = new Map(
    (previous?.results ?? []).map((result) => [result.audioUrl, result]),
  );
  const alerts = [];

  for (const result of current.results ?? []) {
    const prior = previousByUrl.get(result.audioUrl);

    if (!prior) {
      alerts.push({
        audioUrl: result.audioUrl,
        message: `New audio discovered with status ${result.status}.`,
        type: "new_audio",
      });
      continue;
    }

    if (prior.status !== result.status) {
      alerts.push({
        audioUrl: result.audioUrl,
        message: `Audio status changed from ${prior.status} to ${result.status}.`,
        type: "status_changed",
      });
    }

    if (prior.proof?.audioHash && result.proof?.audioHash && prior.proof.audioHash !== result.proof.audioHash) {
      alerts.push({
        audioUrl: result.audioUrl,
        message: "SonoSig audio hash changed.",
        type: "proof_changed",
      });
    }
  }

  return alerts;
}

function normalizeOptions(inputOptions) {
  if (!inputOptions?.url) {
    throw new Error("A root website URL is required.");
  }

  return {
    ...DEFAULT_SCAN_OPTIONS,
    ...inputOptions,
    allowedDomains: inputOptions.allowedDomains ?? [],
    maxAudioBytes: Number(inputOptions.maxAudioBytes ?? DEFAULT_MAX_AUDIO_BYTES),
    maxDepth: Number(inputOptions.maxDepth ?? DEFAULT_MAX_DEPTH),
    maxPages: Number(inputOptions.maxPages ?? DEFAULT_MAX_PAGES),
    rateLimitMs: Number(inputOptions.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS),
    timeoutMs: Number(inputOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  };
}

function normalizeHttpUrl(value, baseUrl) {
  const url = new URL(value, baseUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  url.hash = "";

  return url;
}

async function assertSafeUrl(url, options) {
  if (options.allowPrivateHosts) {
    return;
  }

  const hostname = url.hostname.toLowerCase();

  if (PRIVATE_HOSTNAMES.has(hostname) || hostname.endsWith(".local")) {
    throw new Error(`Private or local hostname is not allowed: ${hostname}`);
  }

  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.some((address) => isPrivateIp(address.address))) {
      throw new Error(`Private network address is not allowed: ${hostname}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Private network")) {
      throw error;
    }
    // DNS lookup can fail for otherwise fetchable hosts; fetch will report the final error.
  }
}

function isPrivateIp(address) {
  if (address.includes(":")) {
    return (
      address === "::1" ||
      address.toLowerCase().startsWith("fc") ||
      address.toLowerCase().startsWith("fd") ||
      address.toLowerCase().startsWith("fe80:")
    );
  }

  const parts = address.split(".").map((part) => Number.parseInt(part, 10));

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254) ||
    parts[0] === 0
  );
}

function createScanId(rootUrl) {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${createHash("sha256")
    .update(rootUrl.href)
    .digest("hex")
    .slice(0, 10)}`;
}

async function loadRobots(rootUrl, options, advancedDiscovery) {
  const robotsUrl = new URL("/robots.txt", rootUrl);

  try {
    const response = await fetchWithTimeout(robotsUrl.href, options, {
      headers: { Accept: "text/plain,*/*" },
    });

    if (!response.ok) {
      return createAllowAllRobots();
    }

    const text = await response.text();
    advancedDiscovery.robots.loaded = true;

    return parseRobots(text, rootUrl);
  } catch {
    return createAllowAllRobots();
  }
}

function parseRobots(text, rootUrl) {
  const disallow = [];
  let applies = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === "user-agent") {
      applies = value === "*" || value.toLowerCase().includes("sonosig");
    }

    if (applies && key === "disallow" && value) {
      disallow.push(value);
    }
  }

  return {
    isAllowed(url) {
      if (url.hostname !== rootUrl.hostname) {
        return true;
      }

      return !disallow.some((path) =>
        path === "/" ? true : url.pathname.startsWith(path),
      );
    },
  };
}

function createAllowAllRobots() {
  return { isAllowed: () => true };
}

async function fetchText(url, options) {
  const response = await fetchWithTimeout(url, options, {
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml,text/xml,application/rss+xml,application/atom+xml,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed with ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  return { contentType, text };
}

async function fetchWithTimeout(url, options, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      headers: {
        "User-Agent": options.userAgent,
        ...(init.headers ?? {}),
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function discoverFromDocument(text, pageUrl) {
  const pageLinks = [];
  const audio = [];
  const manifests = [];
  const feeds = [];
  const title = decodeEntities(matchFirst(text, /<title[^>]*>([\s\S]*?)<\/title>/i));

  for (const match of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    const rawUrl = decodeEntities(match[1]);
    const resolved = safeResolve(rawUrl, pageUrl);

    if (!resolved) {
      continue;
    }

    const extension = extname(resolved.pathname).toLowerCase();
    const nearby = text.slice(Math.max(0, match.index - 160), match.index + 260);

    if (isAudioUrl(resolved.href, nearby)) {
      audio.push({
        audioUrl: resolved.href,
        extension,
        sourceType: inferAudioSourceType(nearby),
      });
      continue;
    }

    if (isLikelyHtmlPage(resolved) && /href=/i.test(match[0])) {
      pageLinks.push(resolved.href);
    }

    if (/rel=["'][^"']*manifest/i.test(nearby) || extension === ".webmanifest") {
      manifests.push(resolved.href);
    }

    if (
      /application\/(rss|atom)\+xml|rel=["'][^"']*alternate/i.test(nearby) ||
      [".rss", ".xml"].includes(extension)
    ) {
      feeds.push(resolved.href);
    }
  }

  for (const jsonUrl of discoverJsonLdAudio(text, pageUrl)) {
    audio.push(jsonUrl);
  }

  return {
    audio: dedupeAudio(audio),
    feeds: Array.from(new Set(feeds)),
    manifests: Array.from(new Set(manifests)),
    pageLinks: Array.from(new Set(pageLinks)),
    title,
  };
}

function safeResolve(rawUrl, baseUrl) {
  try {
    return normalizeHttpUrl(rawUrl, baseUrl);
  } catch {
    return null;
  }
}

function isAudioUrl(url, context = "") {
  const parsed = new URL(url);
  const extension = extname(parsed.pathname).toLowerCase();

  return (
    AUDIO_EXTENSIONS.has(extension) ||
    /<audio\b/i.test(context) ||
    /type=["']audio\//i.test(context) ||
    /property=["']og:audio/i.test(context)
  );
}

function inferAudioSourceType(context) {
  if (/<audio\b/i.test(context)) {
    return "audio_tag";
  }

  if (/<source\b/i.test(context)) {
    return "source_tag";
  }

  if (/og:audio|json-ld/i.test(context)) {
    return "metadata";
  }

  return "anchor";
}

function isLikelyHtmlPage(url) {
  const extension = extname(url.pathname).toLowerCase();

  return !extension || [".html", ".htm", ".php", ".asp", ".aspx"].includes(extension);
}

function discoverJsonLdAudio(text, pageUrl) {
  const audio = [];

  for (const match of text.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1]);
      for (const url of findAudioUrlsInObject(parsed, pageUrl)) {
        audio.push({
          audioUrl: url,
          sourceType: "metadata",
        });
      }
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  return audio;
}

function findAudioUrlsInObject(value, pageUrl) {
  const urls = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      urls.push(...findAudioUrlsInObject(item, pageUrl));
    }
    return urls;
  }

  if (!value || typeof value !== "object") {
    return urls;
  }

  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === "string" &&
      /audio|contentUrl|embedUrl|url/i.test(key)
    ) {
      const resolved = safeResolve(item, pageUrl);
      if (resolved && isAudioUrl(resolved.href, "json-ld")) {
        urls.push(resolved.href);
      }
    } else {
      urls.push(...findAudioUrlsInObject(item, pageUrl));
    }
  }

  return urls;
}

async function discoverSitemapPages(rootUrl, options, advancedDiscovery) {
  const urls = new Set();

  for (const path of DEFAULT_SITEMAP_PATHS) {
    const sitemapUrl = new URL(path, rootUrl).href;
    try {
      const response = await fetchText(sitemapUrl, options);
      advancedDiscovery.sitemaps.push({ status: "loaded", url: sitemapUrl });
      for (const loc of extractLocUrls(response.text, sitemapUrl)) {
        urls.add(loc);
      }
    } catch (error) {
      advancedDiscovery.sitemaps.push({
        error: getErrorMessage(error),
        status: "failed",
        url: sitemapUrl,
      });
    }
  }

  return Array.from(urls);
}

async function discoverFeedPages(rootUrl, options, advancedDiscovery, config = {}) {
  const urls = new Set();
  const feedUrls = config.explicitFeedUrl
    ? [config.explicitFeedUrl]
    : DEFAULT_FEED_PATHS.map((path) => new URL(path, rootUrl).href);

  for (const feedUrl of feedUrls) {
    try {
      const response = await fetchText(feedUrl, options);
      advancedDiscovery.feeds.push({ status: "loaded", url: feedUrl });
      for (const loc of extractLocUrls(response.text, feedUrl)) {
        urls.add(loc);
      }
      for (const link of extractXmlLinks(response.text, feedUrl)) {
        urls.add(link);
      }
    } catch (error) {
      advancedDiscovery.feeds.push({
        error: getErrorMessage(error),
        status: "failed",
        url: feedUrl,
      });
    }
  }

  return Array.from(urls);
}

function extractLocUrls(xml, baseUrl) {
  const urls = [];

  for (const match of xml.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)) {
    const resolved = safeResolve(decodeEntities(match[1].trim()), baseUrl);
    if (resolved) {
      urls.push(resolved.href);
    }
  }

  return urls;
}

function extractXmlLinks(xml, baseUrl) {
  const urls = [];

  for (const match of xml.matchAll(/<link[^>]*>([\s\S]*?)<\/link>/gi)) {
    const resolved = safeResolve(decodeEntities(match[1].trim()), baseUrl);
    if (resolved) {
      urls.push(resolved.href);
    }
  }

  for (const match of xml.matchAll(/\burl=["']([^"']+)["']/gi)) {
    const resolved = safeResolve(decodeEntities(match[1]), baseUrl);
    if (resolved) {
      urls.push(resolved.href);
    }
  }

  return urls;
}

async function discoverManifestAudio(
  manifestUrl,
  foundOn,
  options,
  discoveredAudioMap,
  advancedDiscovery,
  allowedAudioHosts,
) {
  try {
    const response = await fetchText(manifestUrl, options);
    advancedDiscovery.manifests.push({ status: "loaded", url: manifestUrl });
    const audio = [];

    try {
      const parsed = JSON.parse(response.text);
      for (const url of findAudioUrlsInObject(parsed, manifestUrl)) {
        audio.push({ audioUrl: url, sourceType: "manifest" });
      }
    } catch {
      for (const url of extractXmlLinks(response.text, manifestUrl)) {
        if (isAudioUrl(url)) {
          audio.push({ audioUrl: url, sourceType: "manifest" });
        }
      }
    }

    collectAudio(discoveredAudioMap, audio, foundOn, allowedAudioHosts);
  } catch (error) {
    advancedDiscovery.manifests.push({
      error: getErrorMessage(error),
      status: "failed",
      url: manifestUrl,
    });
  }
}

async function discoverHeadlessAudio(pageUrl, options, advancedDiscovery) {
  try {
    const importOptional = new Function(
      "specifier",
      "return import(specifier)",
    );
    const { chromium } = await importOptional("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ userAgent: options.userAgent });
    const seenAudio = new Set();

    page.on("response", (response) => {
      const contentType = response.headers()["content-type"] ?? "";
      if (
        contentType.startsWith("audio/") ||
        AUDIO_EXTENSIONS.has(extname(new URL(response.url()).pathname).toLowerCase())
      ) {
        seenAudio.add(response.url());
      }
    });

    await page.goto(pageUrl, {
      timeout: options.timeoutMs,
      waitUntil: "networkidle",
    });

    const domAudio = await page.$$eval("audio, audio source, a[href]", (nodes) =>
      nodes
        .map((node) => node.getAttribute("src") || node.getAttribute("href"))
        .filter(Boolean),
    );
    await browser.close();
    advancedDiscovery.headless.used = true;

    return [...Array.from(seenAudio), ...domAudio]
      .map((url) => safeResolve(url, pageUrl))
      .filter(Boolean)
      .filter((url) => isAudioUrl(url.href))
      .map((url) => ({ audioUrl: url.href, sourceType: "manifest" }));
  } catch (error) {
    advancedDiscovery.headless.error = getErrorMessage(error);
    return [];
  }
}

function enqueuePage(queue, pageCandidates, url, depth, source, options, allowedHosts) {
  let parsed;

  try {
    parsed = normalizeHttpUrl(url);
  } catch {
    return;
  }

  if (pageCandidates.has(parsed.href)) {
    return;
  }

  if (!isHostAllowed(parsed, allowedHosts, options.followExternalPageLinks)) {
    return;
  }

  pageCandidates.add(parsed.href);
  queue.push({ depth, source, url: parsed.href });
}

function collectAudio(map, discoveries, foundOn, allowedHosts) {
  for (const discovery of discoveries) {
    let parsed;

    try {
      parsed = normalizeHttpUrl(discovery.audioUrl);
    } catch {
      continue;
    }

    if (allowedHosts && !allowedHosts.has(parsed.hostname)) {
      continue;
    }

    const existing = map.get(parsed.href);
    if (existing) {
      if (!existing.foundOn.includes(foundOn)) {
        existing.foundOn.push(foundOn);
      }
      continue;
    }

    map.set(parsed.href, {
      audioUrl: parsed.href,
      contentType: discovery.contentType,
      extension:
        discovery.extension ?? extname(parsed.pathname).toLowerCase() ?? undefined,
      foundOn: [foundOn],
      sourceType: discovery.sourceType ?? "anchor",
    });
  }
}

function isHostAllowed(url, allowedHosts, allowExternal) {
  return allowExternal || allowedHosts.has(url.hostname);
}

async function processAudioDiscovery(item, context) {
  const { options, tempDir } = context;
  const base = {
    audioUrl: item.audioUrl,
    foundOn: item.foundOn,
    sourceType: item.sourceType,
  };

  try {
    const audioUrl = normalizeHttpUrl(item.audioUrl);
    await assertSafeUrl(audioUrl, options);
    const fetchResult = await fetchAudioToFile(audioUrl.href, tempDir, options);

    if (fetchResult.status !== "downloaded") {
      return {
        ...base,
        detail: fetchResult.reason,
        status: "skipped",
      };
    }

    const verification = await verifySonoSigFile(fetchResult.path);
    const enrichment = verification.proof
      ? await enrichProof(verification.proof, options)
      : {};

    return {
      ...base,
      bytes: fetchResult.bytes,
      detail: verification.detail,
      enrichment,
      proof: verification.proof ? publicProof(verification.proof) : undefined,
      status: verification.status,
    };
  } catch (error) {
    return {
      ...base,
      errors: [getErrorMessage(error)],
      status: /watermark|sonosig/i.test(getErrorMessage(error))
        ? "not_sonosig_encoded"
        : "verification_failed",
    };
  }
}

async function fetchAudioToFile(url, tempDir, options) {
  let contentLength = 0;
  let contentType = "";

  try {
    const head = await fetchWithTimeout(url, options, { method: "HEAD" });
    contentLength = Number(head.headers.get("content-length") ?? 0);
    contentType = head.headers.get("content-type") ?? "";

    if (contentLength > options.maxAudioBytes) {
      return { reason: "skipped_too_large", status: "skipped" };
    }
  } catch {
    // Some hosts do not allow HEAD; GET below is authoritative.
  }

  const response = await fetchWithTimeout(url, options, {
    headers: { Accept: "audio/*,*/*" },
  });

  if (!response.ok) {
    return { reason: `fetch_failed_${response.status}`, status: "skipped" };
  }

  contentType = response.headers.get("content-type") ?? contentType;

  if (!isSupportedAudioResponse(url, contentType)) {
    return { reason: "skipped_unsupported_type", status: "skipped" };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.length > options.maxAudioBytes) {
    return { reason: "skipped_too_large", status: "skipped" };
  }

  const path = join(tempDir, safeFileName(url));
  await writeFile(path, bytes);

  return {
    bytes: bytes.length,
    contentType,
    path,
    status: "downloaded",
  };
}

function isSupportedAudioResponse(url, contentType) {
  const extension = extname(new URL(url).pathname).toLowerCase();

  return (
    AUDIO_EXTENSIONS.has(extension) ||
    AUDIO_CONTENT_TYPES.some((prefix) => contentType.toLowerCase().startsWith(prefix))
  );
}

function safeFileName(url) {
  const parsed = new URL(url);
  const extension = extname(parsed.pathname) || ".audio";
  const name = basename(parsed.pathname, extension) || "audio";
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 12);

  return `${name.replace(/[^a-z0-9_-]/gi, "_").slice(0, 48)}-${hash}${extension}`;
}

async function verifySonoSigFile(path) {
  const bytes = new Uint8Array(await readFile(path));
  const proof = readProofFromAudio(bytes);
  const hashes = await tryCreateWatermarkedAudioProofHashes(bytes);

  if (hashes.audio_hash && proof.audio_hash === hashes.audio_hash) {
    return {
      detail: "SonoSig proof and audio hash verified.",
      proof,
      status: "sonosig_verified",
    };
  }

  if (hashes.audio_hash) {
    return {
      detail: "SonoSig proof found, but the audio hash changed after encoding.",
      proof,
      status: "sonosig_payload_found_audio_changed",
    };
  }

  return {
    detail: "SonoSig proof found. Exact audio hash was not checked for this format.",
    proof,
    status: "sonosig_payload_found_hash_not_checked",
  };
}

function readProofFromAudio(bytes) {
  try {
    return readProofFromPcm(readPcm16Audio(bytes).pcm);
  } catch (error) {
    const taggedPayload = readProofFromTaggedBytes(bytes);

    if (taggedPayload) {
      return taggedPayload;
    }

    throw error;
  }
}

function readProofFromPcm(pcm) {
  const header = readBytesFromPcm(pcm, HEADER_BYTES);
  const magic = new TextDecoder().decode(header.slice(0, MAGIC.length));

  if (magic !== MAGIC) {
    throw new Error("No SonoSig watermark header found.");
  }

  const payloadLength = new DataView(
    header.buffer,
    header.byteOffset,
  ).getUint32(MAGIC.length, true);

  if (payloadLength <= 0 || payloadLength > 16_384) {
    throw new Error("Invalid SonoSig payload length.");
  }

  const payloadBytes = readBytesFromPcm(pcm, HEADER_BYTES + payloadLength).slice(
    HEADER_BYTES,
  );

  return validateProofPayload(JSON.parse(new TextDecoder().decode(payloadBytes)));
}

function readBytesFromPcm(pcm, byteCount) {
  const bytes = new Uint8Array(byteCount);

  if (byteCount * 8 > pcm.length) {
    throw new Error("Audio file is too short to contain a SonoSig payload.");
  }

  for (let byteIndex = 0; byteIndex < byteCount; byteIndex += 1) {
    let value = 0;

    for (let bit = 0; bit < 8; bit += 1) {
      value |= (pcm[byteIndex * 8 + bit] & 1) << bit;
    }

    bytes[byteIndex] = value;
  }

  return bytes;
}

function readProofFromTaggedBytes(bytes) {
  for (let offset = bytes.length - HEADER_BYTES; offset >= 0; offset -= 1) {
    if (readAscii(bytes, offset, MAGIC.length) !== MAGIC) {
      continue;
    }

    const payloadLength = new DataView(
      bytes.buffer,
      bytes.byteOffset + offset,
    ).getUint32(MAGIC.length, true);
    const payloadStart = offset + HEADER_BYTES;
    const payloadEnd = payloadStart + payloadLength;

    if (payloadLength <= 0 || payloadLength > 16_384 || payloadEnd > bytes.length) {
      continue;
    }

    try {
      return validateProofPayload(
        JSON.parse(new TextDecoder().decode(bytes.slice(payloadStart, payloadEnd))),
      );
    } catch {
      continue;
    }
  }

  return null;
}

function validateProofPayload(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Proof payload must be an object.");
  }

  if (value.v !== 1 || value.protocol !== "audio-proof-v1") {
    throw new Error("Proof payload must be SonoSig audio-proof-v1.");
  }

  if (!isSha256(value.audio_hash) || !isSha256(value.audio_fingerprint)) {
    throw new Error("Proof payload audio hashes are invalid.");
  }

  return value;
}

async function tryCreateWatermarkedAudioProofHashes(bytes) {
  try {
    const audio = readPcm16Audio(bytes);
    readProofFromPcm(audio.pcm);
    const audio_hash = await hashPcmFingerprint(audio);

    return {
      audio_fingerprint: audio_hash,
      audio_hash,
    };
  } catch {
    return {};
  }
}

function readPcm16Audio(bytes) {
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WAVE") {
    return readWavPcm16(bytes);
  }

  if (readAscii(bytes, 0, 4) === "FORM" && readAscii(bytes, 8, 4) === "AIFF") {
    return readAiffPcm16(bytes);
  }

  throw new Error("Verification currently expects a WAV or AIFF file.");
}

function readWavPcm16(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let audioFormat = 0;
  let bitsPerSample = 0;
  let channels = 0;
  let sampleRate = 0;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(chunkDataOffset, true);
      channels = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    }

    if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataLength = chunkSize;
      break;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || !dataOffset) {
    throw new Error("Verification currently expects 16-bit PCM WAV audio.");
  }

  return {
    channels,
    pcm: new Int16Array(
      bytes.buffer.slice(
        bytes.byteOffset + dataOffset,
        bytes.byteOffset + dataOffset + dataLength,
      ),
    ),
    sampleRate,
  };
}

function readAiffPcm16(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, false);
    const chunkDataOffset = offset + 8;

    if (chunkId === "COMM") {
      channels = view.getUint16(chunkDataOffset, false);
      bitsPerSample = view.getUint16(chunkDataOffset + 6, false);
      sampleRate = readExtended80(bytes, chunkDataOffset + 8);
    }

    if (chunkId === "SSND") {
      const soundOffset = view.getUint32(chunkDataOffset, false);
      dataOffset = chunkDataOffset + 8 + soundOffset;
      dataLength = chunkSize - 8 - soundOffset;
      break;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (bitsPerSample !== 16 || !dataOffset) {
    throw new Error("Verification currently expects 16-bit PCM AIFF audio.");
  }

  const pcm = new Int16Array(dataLength / 2);

  for (let index = 0; index < pcm.length; index += 1) {
    pcm[index] = view.getInt16(dataOffset + index * 2, false);
  }

  return { channels, pcm, sampleRate };
}

function audioBufferToBytes(audio) {
  const buffer = new ArrayBuffer(audio.pcm.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < audio.pcm.length; index += 1) {
    view.setInt16(index * 2, audio.pcm[index], true);
  }

  return new Uint8Array(buffer);
}

async function hashPcmFingerprint(audio) {
  const hash = createHash("sha256");
  const header = Buffer.alloc(8);

  header.writeUInt32LE(audio.sampleRate, 0);
  header.writeUInt16LE(audio.channels, 4);
  header.writeUInt16LE(16, 6);
  hash.update(header);
  hash.update(audioBufferToBytes(audio));

  return `sha256:${hash.digest("hex")}`;
}

async function enrichProof(proof, options) {
  const enrichment = {};
  const claimId = proof.pacstacClaimId ?? proof.claimId;

  if (claimId) {
    enrichment.pacstac = await fetchPacStacClaim(claimId, options);
  } else {
    enrichment.pacstac = {
      status: "not_checked",
      reason: "No PacStac claim ID found in proof.",
    };
  }

  if (proof.ens) {
    enrichment.ens = await fetchEnsSonoSigRecord(proof.ens);
  }

  return enrichment;
}

async function fetchPacStacClaim(claimId, options) {
  const baseUrl = options.pacstacBaseUrl ?? "https://pacstac.com";
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/namespaces/sonosig/claims/${encodeURIComponent(claimId)}`;

  try {
    const response = await fetchWithTimeout(url, options, {
      headers: { Accept: "application/json" },
    });
    const text = await response.text();

    return {
      body: text ? safeJsonParse(text) : null,
      status: response.ok ? "found" : "not_found",
      statusCode: response.status,
      url,
    };
  } catch (error) {
    return {
      error: getErrorMessage(error),
      status: "error",
      url,
    };
  }
}

async function fetchEnsSonoSigRecord(ensName) {
  const rpcUrl = process.env.ETHEREUM_RPC_URL || process.env.EVM_MULTI_CHAIN_RPC_URL;

  if (!rpcUrl) {
    return { status: "not_checked", reason: "Ethereum RPC is not configured." };
  }

  try {
    const publicClient = createPublicClient({
      chain: ETHEREUM_MAINNET,
      transport: http(rpcUrl),
    });
    const value = await publicClient.getEnsText({
      key: "com.sonosig",
      name: ensName,
    });

    return { status: value ? "found" : "missing", value };
  } catch (error) {
    return { error: getErrorMessage(error), status: "error" };
  }
}

function publicProof(proof) {
  return {
    audioFingerprint: proof.audio_fingerprint,
    audioHash: proof.audio_hash,
    claimId: proof.pacstacClaimId ?? proof.claimId,
    ens: proof.ens,
    issuedAt: proof.issued_at,
    manifest: proof.manifest,
    song: proof.song,
    wallet: proof.wallet,
  };
}

function summarizeScan({ audio, errors, pages, results, skipped }) {
  return {
    audioDiscovered: audio.length,
    errors: errors.length,
    notEncoded: results.filter((result) => result.status === "not_sonosig_encoded").length,
    pagesScanned: pages.filter((page) => page.status === "scanned").length,
    payloadChanged: results.filter(
      (result) => result.status === "sonosig_payload_found_audio_changed",
    ).length,
    payloadHashNotChecked: results.filter(
      (result) => result.status === "sonosig_payload_found_hash_not_checked",
    ).length,
    skipped: skipped.length + results.filter((result) => result.status === "skipped").length,
    sonosigVerified: results.filter((result) => result.status === "sonosig_verified").length,
  };
}

function publicOptions(options) {
  return {
    allowedDomains: options.allowedDomains,
    followExternalPageLinks: options.followExternalPageLinks,
    headless: Boolean(options.headless),
    includeExternalAudio: options.includeExternalAudio,
    keepDownloads: options.keepDownloads,
    maxAudioBytes: options.maxAudioBytes,
    maxDepth: options.maxDepth,
    maxPages: options.maxPages,
    rateLimitMs: options.rateLimitMs,
    respectRobots: options.respectRobots,
  };
}

function scanError(url, code, error) {
  return { code, message: getErrorMessage(error), url };
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function dedupeAudio(audio) {
  return Array.from(new Map(audio.map((item) => [item.audioUrl, item])).values());
}

function matchFirst(text, pattern) {
  const match = text.match(pattern);

  return match?.[1]?.trim() ?? "";
}

function decodeEntities(value = "") {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function readAscii(bytes, offset, length) {
  return new TextDecoder().decode(bytes.slice(offset, offset + length));
}

function readExtended80(bytes, offset) {
  const sign = bytes[offset] & 0x80 ? -1 : 1;
  const exponent = (((bytes[offset] & 0x7f) << 8) | bytes[offset + 1]) - 16383;
  let mantissa = 0;

  for (let index = 0; index < 8; index += 1) {
    mantissa = mantissa * 256 + bytes[offset + 2 + index];
  }

  return Math.round(sign * mantissa * 2 ** (exponent - 63));
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return { message: value };
  }
}

function isSha256(value) {
  return typeof value === "string" && /^sha256:[a-fA-F0-9]{64}$/.test(value);
}

function escapeMd(value) {
  return String(value).replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}
