# PacStac SonoSig Namespace Proposal

Last updated: 2026-04-28

## Purpose

This document describes how PacStac can add `sonosig` as a first-class namespace for audio stewardship claims.

SonoSig creates a wallet-signed proof for a specific audio file, embeds that proof in the exported audio, and verifies it locally in the browser. PacStac can extend this by indexing SonoSig claims as public trust records tied to verified wallets, ENS names, domains, and creator identities.

## Summary

Namespace: `sonosig`

Namespace category: audio provenance

Primary identifier: deterministic SonoSig track claim ID

Recommended lookup keys:

- `wallet`
- `ens`
- `audio_hash`
- `audio_fingerprint`
- `isrc`
- `sonosig_claim_id`
- `signature`

Primary value: a SonoSig audio proof payload signed by an EVM wallet.

## Why Add This Namespace

SonoSig answers: "Does this audio file contain a valid wallet-signed proof for this exact audio fingerprint?"

PacStac can answer: "Is this SonoSig track claim registered, still valid, and associated with a verified creator namespace?"

Together:

- SonoSig makes the proof portable inside the audio file.
- PacStac makes the proof discoverable, indexable, revocable, and usable by third-party apps.

## Current SonoSig Proof Shape

SonoSig currently embeds a JSON payload with a `SONOSIG1` header into the exported audio file.

Core fields:

```json
{
  "v": 1,
  "protocol": "audio-proof-v1",
  "ens": "creator.eth",
  "wallet": "0x...",
  "audio_fingerprint": "sha256:...",
  "audio_hash": "sha256:...",
  "manifest": "https://example.com/manifest.json",
  "issued_at": "2026-04-28T12:00:00.000Z",
  "chain_id": 1,
  "signature_type": "SIWE",
  "domain": "sonosig.com",
  "uri": "https://sonosig.com",
  "nonce": "abc123...",
  "statement": "Create a Sonosig wallet-linked proof payload for this local audio file.",
  "verifiedBy": "SonoSig.com",
  "song": {
    "title": "Track title",
    "artist": "Artist name",
    "album": "Album title",
    "isrc": "USXXX2500001"
  },
  "signature": "0x..."
}
```

The `signature` is an EVM personal-sign signature over the deterministic SonoSig SIWE-style message assembled from the payload fields.

## Proposed PacStac Binding Type

PacStac can model a SonoSig registration as a binding from a wallet to an audio claim.

Suggested binding record:

```json
{
  "namespace": "sonosig",
  "version": "1.0",
  "status": "PENDING",
  "wallet": "0x...",
  "chainId": 1,
  "identifier": "sonosig:sha256:<claim_hash>",
  "sonosigClaimId": "sonosig:sha256:<claim_hash>",
  "audioHash": "sha256:<normalized_audio_hash>",
  "audioFingerprint": "sha256:<audio_fingerprint>",
  "siweMessage": "<deterministic SonoSig message>",
  "signature": "0x...",
  "issuedAt": "2026-04-28T12:00:00.000Z",
  "metadata": {
    "ens": "creator.eth",
    "title": "Track title",
    "artist": "Artist name",
    "album": "Album title",
    "isrc": "USXXX2500001",
    "manifest": "https://example.com/manifest.json",
    "source": "sonosig.com"
  }
}
```

## Claim ID

PacStac should derive a stable SonoSig claim ID from canonical claim content rather than trusting a client-supplied ID.

Recommended canonical fields:

- `namespace`
- `version`
- `wallet`
- `chainId`
- `audioHash`
- `audioFingerprint`
- `issuedAt`
- `nonce`
- `signature`

Recommended ID:

```text
sonosig:sha256:<sha256(canonical_json)>
```

Canonical JSON should sort keys alphabetically and remove null or undefined values, matching PacStac attestation conventions.

## Verification Flow

PacStac should verify a SonoSig binding with these checks:

1. Validate JSON schema.
2. Rebuild the deterministic SonoSig SIWE-style message from the submitted payload.
3. Recover the EVM signer from `signature`.
4. Confirm recovered signer equals `wallet`.
5. Confirm `protocol` equals `audio-proof-v1`.
6. Confirm `signature_type` equals `SIWE`.
7. Confirm `audio_hash` and `audio_fingerprint` are present and well formed.
8. If `ens` is present, optionally verify it through PacStac's existing ENS namespace checks.
9. If `manifest` is present, optionally fetch and hash/index it as supporting evidence.
10. Store evidence and move the binding to `VERIFIED` when the signature and required fields pass.

## Optional Audio File Verification

PacStac does not need to ingest the audio file for the initial namespace integration.

The first implementation can treat SonoSig as a signed claim registry:

- SonoSig verifies the file locally.
- PacStac verifies and indexes the signed claim.

A later implementation can add optional file upload or remote URL verification:

1. Fetch or receive a watermarked audio file.
2. Extract the `SONOSIG1` payload.
3. Recompute `audio_hash` and `audio_fingerprint`.
4. Verify the embedded signature.
5. Compare extracted proof to the registered PacStac binding.

## Status Model

Suggested PacStac statuses:

- `PENDING`: claim received but not verified.
- `VERIFIED`: signature and required claim fields are valid.
- `FAILED`: claim is malformed, signature does not recover, or required fields mismatch.
- `REVOKED`: creator or admin revoked the claim.
- `SUPERSEDED`: a newer SonoSig claim replaced this registration.

## Trust Weighting

A SonoSig claim should become more trustworthy when the signing wallet also has verified PacStac namespaces:

- ENS forward, reverse, and text records pass.
- Domain DNS TXT or well-known proof passes.
- X or YouTube binding passes.

Suggested display language:

- "SonoSig track registered by a verified PacStac wallet"
- "SonoSig track registered by an unverified wallet"
- "SonoSig track registration revoked"

## API Expectations

SonoSig has a server-only `PACSTAC_API_KEY`. It should never be exposed to browser code.

Suggested create endpoint:

```http
POST /v1/namespaces/sonosig/claims
Authorization: Bearer <PACSTAC_API_KEY>
Content-Type: application/json
```

Request:

```json
{
  "payload": {
    "v": 1,
    "protocol": "audio-proof-v1",
    "wallet": "0x...",
    "chain_id": 1,
    "audio_hash": "sha256:...",
    "audio_fingerprint": "sha256:...",
    "issued_at": "2026-04-28T12:00:00.000Z",
    "nonce": "abc123...",
    "signature_type": "SIWE",
    "signature": "0x..."
  },
  "siweMessage": "<deterministic SonoSig message>",
  "source": {
    "app": "sonosig",
    "origin": "https://sonosig.com"
  }
}
```

Response:

```json
{
  "namespace": "sonosig",
  "claimId": "sonosig:sha256:<claim_hash>",
  "status": "VERIFIED",
  "wallet": "0x...",
  "audioHash": "sha256:...",
  "audioFingerprint": "sha256:...",
  "createdAt": "2026-04-28T12:00:10.000Z",
  "attestation": {
    "kid": "pstc_kid_...",
    "sig": "base64url..."
  }
}
```

Suggested lookup endpoints:

```http
GET /v1/namespaces/sonosig/claims/:claimId
GET /v1/namespaces/sonosig/claims?wallet=0x...
GET /v1/namespaces/sonosig/claims?audioHash=sha256:...
GET /v1/namespaces/sonosig/claims?audioFingerprint=sha256:...
GET /v1/namespaces/sonosig/claims?isrc=USXXX2500001
```

## SonoSig Product Flow

Recommended user flow:

1. User connects wallet in SonoSig.
2. User selects an audio file.
3. SonoSig computes audio proof hashes locally.
4. User signs the SonoSig message.
5. SonoSig embeds the proof into the exported audio file.
6. SonoSig asks whether to register the signed track with PacStac.
7. On opt-in, SonoSig sends the proof payload to a server route.
8. Server route uses `PACSTAC_API_KEY` to create the PacStac `sonosig` claim.
9. SonoSig stores the returned `claimId` with the local proof and displays PacStac status.

## Verification UX

SonoSig verification can show two independent results:

- Local file proof: valid or invalid SonoSig watermark and signature.
- PacStac registration: registered, verified, revoked, superseded, or not found.

Example:

```text
SonoSig proof: valid
PacStac status: verified
Registered wallet: 0x...
Verified creator namespaces: ENS, domain
PacStac claim: sonosig:sha256:...
```

## Revocation and Replacement

PacStac should support explicit claim revocation by the signing wallet or by a SonoSig admin API credential.

Recommended revocation evidence:

- Original `claimId`
- Revocation reason
- Revocation timestamp
- Wallet signature over a deterministic revocation message, when user initiated
- Admin API actor, when server initiated

Recommended replacement evidence:

- Original `claimId`
- New `claimId`
- Reason, such as remaster, metadata correction, rights transfer, or bad upload

## Privacy and Abuse Controls

SonoSig should ask for explicit user consent before registering a track with PacStac because registration creates a public indexed claim.

PacStac should avoid requiring full audio uploads in the base namespace. Track registration can work with hashes, fingerprints, metadata, and signatures.

Suggested controls:

- Rate limit by API key and wallet.
- Reject duplicate exact claims as idempotent success.
- Keep raw submitted SIWE messages as evidence.
- Store claim metadata separately from immutable verification evidence.
- Allow users to omit optional song metadata.

## Open Questions for PacStac

- Should `sonosig` claims contribute to PacStac trust points?
- Should claim status depend only on signature validity, or also on wallet namespace verification?
- Should PacStac issue signed attestations for each verified SonoSig claim?
- Should PacStac accept optional audio file verification in v1, or keep v1 claim-only?
- Should rights transfers be modeled as revocation plus replacement, or as a separate transfer event?
- Should SonoSig claim lookup be public by default?

## Minimal V1 Scope

The smallest useful PacStac integration:

1. Add namespace `sonosig`.
2. Accept a SonoSig proof payload plus deterministic SIWE message.
3. Verify the wallet signature.
4. Derive and return a `sonosig:sha256:<claim_hash>` ID.
5. Store status and evidence.
6. Expose lookup by claim ID, wallet, `audio_hash`, and `audio_fingerprint`.
7. Return a PacStac signed attestation for verified claims.

This gives SonoSig public registration and third-party lookup without requiring PacStac to process audio files in the first version.
