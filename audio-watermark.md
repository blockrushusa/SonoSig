# SonoSig Audio Proof Format

Last reviewed: 2026-05-01

This document describes the current SonoSig audio proof implementation in this
repository. It is not a future robust watermarking proposal.

## Overview

SonoSig creates a wallet-signed provenance proof for an audio file and embeds
that proof into an exported audio artifact. The proof is designed to be readable
by the browser app, the MCP server, the website scanner agent, and future
registry/indexing systems.

SonoSig verifies technical provenance signals:

- a valid EVM wallet signature over a deterministic SonoSig message
- the wallet address that signed the proof
- the embedded proof payload
- the normalized PCM audio hash where the format supports exact checking
- optional public discovery records in PacStac and ENS

SonoSig does not prove legal copyright ownership.

## Current Container

Every embedded proof uses the `SONOSIG1` container:

| Bytes | Meaning |
|---|---|
| `0..7` | ASCII magic string `SONOSIG1`. |
| `8..11` | Unsigned 32-bit little-endian JSON payload length. |
| `12..n` | UTF-8 JSON proof payload. |

The browser docs currently describe a 16 KB payload maximum for the proof block.

## Proof Payload

Current payloads use protocol `audio-proof-v1` and version `1`.

Core fields:

```json
{
  "v": 1,
  "protocol": "audio-proof-v1",
  "wallet": "0x...",
  "address": "0x...",
  "chain_id": 1,
  "chainId": 1,
  "audio_hash": "sha256:...",
  "audio_fingerprint": "sha256:...",
  "audioFingerprint": "sha256:...",
  "issued_at": "2026-05-01T00:00:00.000Z",
  "issuedAt": "2026-05-01T00:00:00.000Z",
  "nonce": "...",
  "domain": "sonosig.com",
  "uri": "https://sonosig.com",
  "statement": "Create a Sonosig wallet-linked proof payload for this local audio file.",
  "signature_type": "SIWE",
  "signature": "0x..."
}
```

Optional fields include:

- `ens`
- `manifest`
- `chain`
- `verifiedBy`
- `sourceFileName`
- `song` metadata such as title, artist, album, ISRC, genre, BPM, key, and notes

## Signing Message

The signature is an EVM wallet signature over a deterministic SIWE-style
SonoSig message. The message includes:

- domain and URI
- wallet/address
- chain ID and optional chain name
- protocol
- audio fingerprint
- audio hash
- nonce
- issued timestamp
- signature type
- optional ENS, manifest, song metadata, and verified-by value

Verifiers must rebuild the exact message from the payload and recover the
signing wallet from `signature`.

## Audio Hashing

SonoSig derives `audio_hash` and `audio_fingerprint` from normalized PCM sample
data in the browser. Verification can recompute exact PCM hashes for supported
PCM exports.

Current exact audio-hash verification is strongest for:

- WAV
- AIFF

For compressed exports, SonoSig can still extract and validate the embedded
proof block, but exact sample hash comparison may be unavailable or may report
that audio changed after encoding.

## Embedding

### WAV and AIFF

For PCM WAV and AIFF exports, SonoSig embeds the `SONOSIG1` block into the least
significant bit of sequential 16-bit PCM samples. Each payload byte is written
least-significant bit first.

Verification reads the same sample sequence, reconstructs the `SONOSIG1` header
and payload, validates the proof, and recomputes the PCM hash where possible.

### M4A and OGG

For M4A and OGG exports, SonoSig appends the `SONOSIG1` proof block to the
encoded file bytes. This keeps the proof portable, but exact audio-hash
verification is not as strong as PCM WAV/AIFF because lossy encoders can change
sample data.

### MCP Encoding

The MCP server currently appends a `SONOSIG1` proof block to the target audio
file. It does not create wallet signatures. The proof must already be signed.

## Verification Statuses

Verification surfaces commonly use these statuses:

| Status | Meaning |
|---|---|
| `verified` | The proof was found and the recomputed PCM audio hash matched. |
| `changed_after_encoding` | The proof was found, but a recomputed PCM hash did not match. |
| `not_checked` | The proof was found, but exact PCM hash verification was unavailable. |
| `not_sonosig_encoded` | No valid `SONOSIG1` proof was found. |
| `verification_failed` | A proof or candidate file could not be parsed or verified. |

## PacStac Registration

SonoSig can submit the signed proof to PacStac under the `sonosig` namespace.
PacStac verifies/indexes the claim for public discovery by wallet, claim ID,
audio hash, audio fingerprint, ENS, and song metadata where available.

Current claim creation still needs server-side PacStac API-key support unless
PacStac advertises x402 payment support for that write endpoint. x402 mode is
used for paid PacStac reads and can attempt paid requests when supported.

## ENS Discovery

SonoSig uses one ENS text record as a creator-level discovery pointer:

```txt
com.sonosig = pacstac:wallet:0x1234567890abcdef1234567890abcdef12345678
```

This points agents and apps to the creator wallet's PacStac collection. It does
not point to one song. The one-record-per-wallet design lets a single ENS name
represent many SonoSig audio claims.

## Security and Limitations

- SonoSig proves a wallet signed a specific proof payload.
- SonoSig does not prove copyright ownership or resolve authorship disputes.
- PCM LSB embedding is not a robust anti-removal watermark.
- M4A/OGG appended proof blocks may be stripped by file transformations.
- Exact audio-hash verification is format-dependent.
- Public PacStac, ENS, blockchain, wallet, and RPC systems can be unavailable or
  delayed independently of SonoSig.
