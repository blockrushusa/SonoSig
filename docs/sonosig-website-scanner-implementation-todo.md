# SonoSig Website Scanner Implementation TODO

Granular checklist for the full website scanner implementation.

## Scanner Engine

- [x] Create reusable scanner module in `scripts/sonosig-website-scanner.mjs`.
- [x] Validate input root URL.
- [x] Restrict scans to `http` and `https`.
- [x] Block localhost/private/internal hosts by default.
- [x] Add `allowPrivateHosts` override for owned/local testing.
- [x] Normalize URLs and remove fragments.
- [x] Support `maxPages`.
- [x] Support `maxDepth`.
- [x] Support `allowedDomains`.
- [x] Support optional external page crawling.
- [x] Support optional external/CDN audio scanning.
- [x] Add user-agent identification.
- [x] Add page request rate limiting.
- [x] Add fetch timeout handling.
- [x] Load and apply `robots.txt` rules.
- [x] Record robots load status in the scan report.
- [x] Crawl static HTML pages.
- [x] Parse page links from `href` attributes.
- [x] Parse audio URLs from `<audio>` tags.
- [x] Parse audio URLs from `<source>` tags.
- [x] Parse direct audio links from anchors.
- [x] Detect audio by common extensions.
- [x] Detect audio by nearby `type="audio/*"` hints.
- [x] Detect Open Graph audio metadata.
- [x] Parse JSON-LD for audio/content URLs.
- [x] Dedupe discovered page URLs.
- [x] Dedupe discovered audio URLs.
- [x] Track every page where an audio URL was found.

## Advanced Discovery

- [x] Discover URLs from `/sitemap.xml`.
- [x] Discover URLs from `/sitemap_index.xml`.
- [x] Discover URLs from common RSS/Atom feed paths.
- [x] Discover feed URLs linked from page metadata.
- [x] Discover audio URLs from web manifests or media manifests.
- [x] Add optional Playwright headless discovery.
- [x] Gracefully degrade when Playwright is not installed.
- [x] Record sitemap/feed/manifest/headless status in reports.

## Audio Fetching

- [x] Send `HEAD` request when supported.
- [x] Check `Content-Length` before download.
- [x] Enforce max audio file size.
- [x] Check response status.
- [x] Check content type and extension.
- [x] Download audio with timeout.
- [x] Store audio temporarily under `.local/website-scans/<scan-id>/`.
- [x] Delete temporary downloads by default.
- [x] Add `keepDownloads` option for debug retention.
- [x] Classify skipped/fetch-failed audio.

## SonoSig Verification

- [x] Read appended `SONOSIG1` proof blocks.
- [x] Read LSB-encoded proofs from PCM WAV/AIFF when present.
- [x] Validate SonoSig `audio-proof-v1` payloads.
- [x] Compute PCM audio hash for 16-bit WAV.
- [x] Compute PCM audio hash for 16-bit AIFF.
- [x] Classify `sonosig_verified`.
- [x] Classify `sonosig_payload_found_audio_changed`.
- [x] Classify `sonosig_payload_found_hash_not_checked`.
- [x] Classify `not_sonosig_encoded`.
- [x] Classify `verification_failed`.
- [x] Preserve public proof fields in scan output.

## Enrichment

- [x] Add PacStac claim lookup when a claim ID exists in the proof.
- [x] Add ENS `com.sonosig` lookup when an ENS name exists and RPC is configured.
- [x] Include enrichment status without failing the scan when upstream services fail.

## Reporting

- [x] Generate JSON report.
- [x] Generate Markdown report.
- [x] Include root URL, scan ID, timestamps, pages, audio, results, errors, skipped items, and summary.
- [x] Include verified files table.
- [x] Include all audio findings table.
- [x] Include legal/provenance limitation note.
- [x] Add baseline comparison for new audio.
- [x] Add baseline comparison for status changes.
- [x] Add baseline comparison for proof audio-hash changes.

## CLI

- [x] Add `scripts/scan-sonosig-website.mjs`.
- [x] Add `npm run scan:website`.
- [x] Support one-shot scans.
- [x] Support scheduled scans with `--schedule-seconds`.
- [x] Support baseline comparison with `--baseline`.
- [x] Support non-zero alert exit with `--fail-on-alert`.
- [x] Support output directory selection.
- [x] Support crawl, size, robot, headless, same-origin, and private-host flags.
- [x] Support `--scan-scope auto|page|site`.
- [x] In auto scope, scan specific page URLs as one page and root URLs as sites.
- [x] Print Markdown report to stdout.
- [x] Write `scan-report.json`.
- [x] Write `scan-report.md`.

## MCP

- [x] Add `sonosig_scan_website` tool to the SonoSig MCP server.
- [x] Expose crawl and safety options in tool schema.
- [x] Return summary, results, errors, advanced discovery details, and Markdown.
- [x] Confirm MCP tools list includes `sonosig_scan_website`.
- [x] Update developer MCP UI tool list.
- [x] Update MCP agent guide.

## Admin Dashboard

- [x] Add protected admin API route `/api/admin/website-scan`.
- [x] Require Firebase admin token for scanner API.
- [x] Clamp admin-provided scan limits.
- [x] Add `/admin/website-scanner` page.
- [x] Add `AdminWebsiteScanner` component.
- [x] Add URL, max pages, max depth, robots, external audio, and headless controls.
- [x] Render scan summary metrics.
- [x] Render result rows.
- [x] Highlight SonoSig proof findings.
- [x] Render Markdown report preview.
- [x] Add Agentic Scan to Admin menu.
- [x] Add admin-gated `/website-scanner` route alias.

## Docs

- [x] Update scanner plan with implementation status.
- [x] Add README scanner command.
- [x] Link scanner plan from README.
- [x] Update MCP guide with website scanner tool.
- [x] Add this implementation TODO.

## Verification

- [x] Run CLI help check.
- [x] Run MCP initialize/tools-list smoke test.
- [x] Run ESLint.
- [x] Run production build.
- [x] Note that local loopback scan smoke test is blocked by sandbox network listen/connect restrictions unless run outside sandbox.
