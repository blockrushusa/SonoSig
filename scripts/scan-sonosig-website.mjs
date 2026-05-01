#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  compareScanReports,
  scanWebsite,
  writeScanReports,
} from "./sonosig-website-scanner.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.url) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

if (args.scheduleSeconds) {
  await runScheduledScans(args);
} else {
  const result = await runOnce(args);
  process.exit(result.alerts.length && args.failOnAlert ? 2 : 0);
}

async function runScheduledScans(options) {
  let previousReport = options.baseline ? await readJson(options.baseline) : null;
  let runIndex = 0;

  while (true) {
    runIndex += 1;
    console.error(`Starting SonoSig website scan ${runIndex} for ${options.url}`);
    const { alerts, report } = await runOnce({
      ...options,
      previousReport,
      runLabel: `run-${runIndex}`,
    });
    previousReport = report;

    if (alerts.length && options.failOnAlert) {
      process.exitCode = 2;
    }

    await delay(options.scheduleSeconds * 1000);
  }
}

async function runOnce(options) {
  const previousReport = options.previousReport ?? (options.baseline ? await readJson(options.baseline) : null);
  const report = await scanWebsite({
    allowPrivateHosts: Boolean(options.allowPrivate),
    allowedDomains: options.allowedDomain,
    followExternalPageLinks: Boolean(options.followExternalPages),
    headless: Boolean(options.headless),
    includeExternalAudio: !options.sameOriginAudioOnly,
    keepDownloads: Boolean(options.keepDownloads),
    maxAudioBytes: options.maxAudioBytes,
    maxDepth: options.maxDepth,
    maxPages: options.maxPages,
    rateLimitMs: options.rateLimitMs,
    respectRobots: !options.ignoreRobots,
    timeoutMs: options.timeoutMs,
    url: options.url,
  });
  const outputDir =
    options.outputDir ??
    join(process.cwd(), ".local", "website-scans", options.runLabel ?? report.scanId);
  const written = await writeScanReports(report, outputDir);
  const alerts = previousReport ? compareScanReports(previousReport, report) : [];

  if (alerts.length) {
    report.alerts = alerts;
    console.error(`SonoSig scan generated ${alerts.length} alert(s).`);
    for (const alert of alerts) {
      console.error(`- ${alert.type}: ${alert.audioUrl} - ${alert.message}`);
    }
  }

  console.log(report.markdown);
  console.error(`JSON report: ${written.jsonPath}`);
  console.error(`Markdown report: ${written.markdownPath}`);

  return { alerts, report };
}

function parseArgs(argv) {
  const parsed = {
    allowedDomain: [],
    maxAudioBytes: undefined,
    maxDepth: undefined,
    maxPages: undefined,
    rateLimitMs: undefined,
    timeoutMs: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--url") {
      parsed.url = next;
      index += 1;
    } else if (arg === "--max-pages") {
      parsed.maxPages = Number(next);
      index += 1;
    } else if (arg === "--max-depth") {
      parsed.maxDepth = Number(next);
      index += 1;
    } else if (arg === "--max-audio-bytes") {
      parsed.maxAudioBytes = Number(next);
      index += 1;
    } else if (arg === "--rate-limit-ms") {
      parsed.rateLimitMs = Number(next);
      index += 1;
    } else if (arg === "--timeout-ms") {
      parsed.timeoutMs = Number(next);
      index += 1;
    } else if (arg === "--allowed-domain") {
      parsed.allowedDomain.push(next);
      index += 1;
    } else if (arg === "--output-dir") {
      parsed.outputDir = next;
      index += 1;
    } else if (arg === "--baseline") {
      parsed.baseline = next;
      index += 1;
    } else if (arg === "--schedule-seconds") {
      parsed.scheduleSeconds = Number(next);
      index += 1;
    } else if (arg === "--ignore-robots") {
      parsed.ignoreRobots = true;
    } else if (arg === "--same-origin-audio-only") {
      parsed.sameOriginAudioOnly = true;
    } else if (arg === "--follow-external-pages") {
      parsed.followExternalPages = true;
    } else if (arg === "--headless") {
      parsed.headless = true;
    } else if (arg === "--keep-downloads") {
      parsed.keepDownloads = true;
    } else if (arg === "--allow-private") {
      parsed.allowPrivate = true;
    } else if (arg === "--fail-on-alert") {
      parsed.failOnAlert = true;
    } else if (!parsed.url && !arg.startsWith("-")) {
      parsed.url = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function printHelp() {
  console.log(`SonoSig website scanner

Usage:
  npm run scan:website -- --url https://example.com
  node scripts/scan-sonosig-website.mjs https://example.com --max-pages 25

Options:
  --url <url>                  Root website URL.
  --max-pages <number>         Maximum HTML pages to scan.
  --max-depth <number>         Maximum crawl depth.
  --max-audio-bytes <number>   Maximum audio download size.
  --rate-limit-ms <number>     Delay between page requests.
  --timeout-ms <number>        Fetch timeout.
  --allowed-domain <host>      Additional allowed page host. Repeatable.
  --output-dir <path>          Directory for scan-report.json and scan-report.md.
  --baseline <path>            Previous scan-report.json for alert comparison.
  --schedule-seconds <number>  Repeat scans on this interval.
  --headless                   Try Playwright-based JS discovery if installed.
  --same-origin-audio-only     Ignore externally hosted audio files.
  --follow-external-pages      Allow crawling pages on allowed extra domains.
  --ignore-robots              Do not apply robots.txt rules.
  --keep-downloads             Keep temporary audio downloads.
  --allow-private              Allow localhost/private IP scan targets.
  --fail-on-alert              Exit with code 2 when baseline alerts are found.
`);
}
