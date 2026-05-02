# SonoSig Website Scanner Agent Plan

Plan and implementation notes for an agent that scans a public website for audio files encoded with SonoSig.

## Implementation Status

Implemented surfaces:

- CLI: `npm run scan:website -- --url https://example.com`
- Shared scanner engine: `scripts/sonosig-website-scanner.mjs`
- MCP tool: `sonosig_scan_website`
- Admin dashboard: `/admin/website-scanner`
- Admin-gated route alias: `/website-scanner`
- Admin API: `/api/admin/website-scan`

Implemented milestones:

- Static HTML crawl and audio discovery.
- Safe audio fetching with size/time limits and temporary cleanup.
- SonoSig proof verification.
- PacStac/ENS enrichment where IDs and RPC/API access are available.
- JSON and Markdown reports.
- `robots.txt`, rate limit, redirects, sitemap, RSS/feed, manifest, and optional Playwright headless discovery.
- Scheduled CLI scans with baseline comparison alerts.
- Admin dashboard scan view.
- Scan scope control: `auto`, `page`, or `site`. In `auto`, a specific page URL scans only that page, while a root URL scans as a site.

## Goal

Create an agent that accepts a website URL, crawls reachable pages, finds audio files, downloads or streams safe samples, checks whether they contain a SonoSig proof, and returns a report of verified, unverified, inaccessible, and suspicious files.

## 1. Scope

### Inputs

- Root website URL.
- Optional max pages.
- Optional max depth.
- Optional scan scope: `auto`, `page`, or `site`.
- Optional allowed domains.
- Optional file size limit.
- Optional auth/session headers in a later version.

### Outputs

- List of scanned pages.
- List of discovered audio URLs.
- SonoSig verification status per file.
- Extracted proof details when found.
- Wallet, claim ID, audio hash, ENS/PacStac status if available.
- Errors and skipped files.
- JSON and human-readable report.

### Initial Constraints

- Public websites only.
- Respect `robots.txt` where appropriate.
- Do not bypass auth, paywalls, rate limits, or access controls.
- Limit downloads by size and time.
- Avoid retaining downloaded audio unless the user explicitly requests it.

## 2. Discovery Crawler

Build a crawler that:

- Starts from a provided URL.
- Normalizes URLs.
- Stays within allowed domains.
- Parses HTML for:
  - `<audio src="">`
  - `<source src="" type="audio/...">`
  - Direct links to audio files.
  - Common file extensions: `.wav`, `.aiff`, `.aif`, `.mp3`, `.flac`, `.m4a`, `.ogg`.
  - Open Graph/audio metadata if present.
  - JSON-LD or embedded media manifests.
- Handles relative URLs.
- Avoids duplicate URLs.
- Records where each audio URL was found.
- In `page` scope, scans only the supplied page and does not enqueue other same-site links.
- In `site` scope, crawls reachable pages within `maxPages` and `maxDepth`.
- In `auto` scope, treats root/home URLs as site scans and specific page URLs as page-only scans.

Recommended data model:

```ts
type DiscoveredAudio = {
  audioUrl: string;
  foundOn: string[];
  sourceType: "audio_tag" | "source_tag" | "anchor" | "metadata" | "manifest";
  contentType?: string;
  extension?: string;
};
```

## 3. Audio Fetcher

For each discovered audio URL:

1. Send `HEAD` first when possible.
2. Check `Content-Type`.
3. Check `Content-Length`.
4. Skip files above configured limit.
5. Download with timeout.
6. Store temporarily in a scan workspace.
7. Delete temporary files after reporting unless retention is requested.

Fetcher statuses:

- `downloaded`
- `skipped_too_large`
- `skipped_unsupported_type`
- `blocked`
- `timeout`
- `not_found`
- `fetch_failed`

## 4. SonoSig Verification

Use the existing MCP tool:

- `sonosig_verify_file`

For each downloaded audio file:

1. Run verification.
2. If proof is found, extract:
   - wallet
   - audio hash
   - audio fingerprint
   - issued date
   - ENS
   - manifest
   - song metadata
   - signature
   - audio hash status

Classification:

- `sonosig_verified`
- `sonosig_payload_found_audio_changed`
- `sonosig_payload_found_hash_not_checked`
- `not_sonosig_encoded`
- `verification_failed`
- `unsupported_format`

## 5. Optional Claim Enrichment

For verified files, enrich with:

- PacStac claim lookup, if an API is available.
- ENS `com.sonosig` text record check, if ENS name is present.
- Public explorer links for relevant transaction hashes, if known.

Local transaction history is not useful for public website scans unless the scanner has access to the same user-local browser records.

Result model:

```ts
type SonoSigScanResult = {
  audioUrl: string;
  foundOn: string[];
  status:
    | "sonosig_verified"
    | "sonosig_payload_found_audio_changed"
    | "sonosig_payload_found_hash_not_checked"
    | "not_sonosig_encoded"
    | "verification_failed"
    | "skipped";
  proof?: {
    wallet: string;
    audioHash: string;
    audioFingerprint: string;
    issuedAt: string;
    ens?: string;
    claimId?: string;
    song?: {
      title?: string;
      artist?: string;
      album?: string;
      isrc?: string;
    };
  };
  errors?: string[];
};
```

## 6. Agent Workflow

1. Validate website URL.
2. Fetch and interpret `robots.txt`.
3. Crawl pages within limits.
4. Extract audio URLs.
5. Deduplicate audio URLs.
6. Fetch audio files safely.
7. Run `sonosig_verify_file` on each downloaded file.
8. Enrich verified proofs where possible.
9. Generate report.
10. Delete temporary files unless retention is requested.

## 7. Report Format

The agent should produce both Markdown and JSON.

Markdown report sections:

- Scan summary.
- Verified SonoSig files.
- Audio files without SonoSig proof.
- Files skipped or inaccessible.
- Errors.
- Suggested next actions.

Example:

```md
# SonoSig Website Audio Scan

Root URL: https://example.com
Pages scanned: 42
Audio files discovered: 18
SonoSig verified: 6
SonoSig payload found but audio changed: 1
Not encoded: 8
Skipped: 3

## Verified Files

| Audio URL | Wallet | ENS | Audio hash | Issued |
|---|---|---|---|---|
```

## 8. Safety and Abuse Controls

The scanner should:

- Respect domain limits.
- Avoid aggressive crawling.
- Use rate limits.
- Avoid private/internal IP ranges.
- Avoid scanning localhost unless explicitly allowed.
- Refuse credential bypass.
- Avoid storing copyrighted audio longer than needed.
- Show that SonoSig verification is technical provenance, not legal copyright ownership.
- Include user-agent identification for responsible crawling.

## 9. Implementation Options

Best first version:

- Build as a CLI script in `scripts/scan-sonosig-website.mjs`.
- Use the MCP server internally or share verification utilities.
- Output `scan-report.json` and `scan-report.md`.
- Store temporary downloads under `.local/website-scans/<scan-id>/`.
- Clean temporary downloads after the report is written by default.

Later expose it as:

- MCP tool: `sonosig_scan_website`
- Admin-gated web page.
- API endpoint.
- Scheduled monitoring job.

## 10. Suggested Milestones

### Milestone 1: CLI Scanner

- Crawl static HTML.
- Discover common audio URLs.
- Download with limits.
- Verify via existing SonoSig proof reader.
- Output JSON and Markdown.

### Milestone 2: Enrichment and Politeness

- Add PacStac/ENS enrichment.
- Add robots/rate-limit controls.
- Add better MIME detection.
- Add retry and redirect handling.

### Milestone 3: Agent Integration

- Add MCP tool wrapper.
- Add dashboard view.
- Add scheduled scans.
- Add alerting when new unverified or changed audio appears.

### Milestone 4: Advanced Discovery

- Add headless browser mode for JavaScript-heavy sites.
- Add sitemap parsing.
- Add RSS/feed scanning.
- Add media manifest support.

## 11. Open Questions

- Should the scanner strictly obey `robots.txt`, or allow an override for sites the user owns?
- Should verified proof data be stored in Firestore or only emitted as a local report?
- Should the scanner support authenticated scans for creator-owned dashboards later?
- Should public, non-admin users eventually get a limited scanner UI separate from the admin-gated route?
