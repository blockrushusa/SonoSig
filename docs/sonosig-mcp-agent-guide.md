# SonoSig MCP Agent Guide

Practical instructions for AI agents and MCP clients that need to interact with the local SonoSig Model Context Protocol server.

## Purpose

The SonoSig MCP server lets an agent work with signed SonoSig audio proofs outside the browser app. It can:

- Embed an already-signed SonoSig proof payload into an audio file.
- Verify an encoded file and read its embedded proof.
- Register a signed SonoSig proof with PacStac.
- Prepare the ENS `com.sonosig` text-record value.
- Submit an ENS text-record transaction when explicitly confirmed.

The server does not create wallet signatures for users. A proof must already be signed by a wallet before it can be encoded or registered.

## Server Entry Point

Run from the repository root:

```bash
npm run mcp:stdio
```

This starts:

```bash
node scripts/sonosig-mcp-server.mjs
```

The server uses stdio transport and reports:

```text
SonoSig MCP server running on stdio
```

## Client Configuration

Use this MCP configuration for clients that support stdio servers:

```json
{
  "mcpServers": {
    "sonosig": {
      "command": "npm",
      "args": ["run", "mcp:stdio"],
      "cwd": "/Users/bruceseymour/Documents/code/sonosig"
    }
  }
}
```

Adjust `cwd` if the repository is checked out somewhere else.

## Environment Variables

The MCP server loads environment variables from these files, in order:

1. `.env.local`
2. `.evm.local`
3. `.env`

Existing process environment variables take precedence over file values.

| Variable | Required for | Notes |
|---|---|---|
| `PACSTAC_API_KEY` | `sonosig_submit_pacstac` | Bearer token used to register claims with PacStac. |
| `PACSTAC_SONOSIG_CLAIMS_URL` | Optional PacStac override | Defaults to `https://pacstac.com/api/v1/namespaces/sonosig/claims`. |
| `EVM_MULTI_CHAIN_RPC_URL` | ENS resolver/write fallback | Used for ENS writes if present. |
| `ETHEREUM_RPC_URL` | ENS writes | Ethereum mainnet RPC. |
| `ENS_SUBGRAPH_URL` | ENS resolver lookup | Defaults to the ENS subgraph URL in the server. |
| `SONOSIG_ENS_PRIVATE_KEY` | `sonosig_submit_ens` | Private key for the wallet that owns or manages the ENS name. |
| `BASE_X402_WALLET_PRIVATE_KEY` | `sonosig_submit_ens` fallback | Used only if `SONOSIG_ENS_PRIVATE_KEY` is absent. |
| `BASE_X402_WALLET_PUBLIC_KEY` | ENS key safety check | If set, must match the configured private key address. |

Do not expose private keys or API keys to browser code or user-visible logs.

## Tool Inventory

The server currently exposes these tools:

| Tool | Purpose | Network/write behavior |
|---|---|---|
| `sonosig_encode_file` | Appends a `SONOSIG1` proof block to an audio file. | Local file write only. |
| `sonosig_verify_file` | Reads and validates an embedded SonoSig proof from an encoded file. | Local file read only. |
| `sonosig_submit_pacstac` | Registers a signed proof with PacStac. | Sends network request to PacStac. |
| `sonosig_prepare_ens_record` | Builds the compact ENS record value. | No write. |
| `sonosig_submit_ens` | Writes the ENS `com.sonosig` text record. | Sends Ethereum mainnet transaction; requires `confirm: true`. |

## Proof Payload Requirements

The server validates signed proofs before encode, verify, PacStac registration, or ENS record preparation.

Required proof fields include:

| Field | Requirement |
|---|---|
| `v` | Must be `1`. |
| `protocol` | Must be `audio-proof-v1`. |
| `wallet` | Valid EVM address. |
| `address` | Valid EVM address. |
| `chain_id` | Integer. |
| `chainId` | Integer. |
| `audio_hash` | `sha256:<64 hex chars>`. |
| `audio_fingerprint` | `sha256:<64 hex chars>`. |
| `issued_at` | String timestamp. |
| `issuedAt` | String timestamp. |
| `nonce` | String. |
| `signature_type` | String. |
| `domain` | String. |
| `uri` | String. |
| `statement` | String. |
| `audioFingerprint` | String. |
| `signature` | Wallet signature string. |

Optional fields such as `ens`, `manifest`, and `song` are preserved where supported and forwarded to PacStac when present.

## Tool Details

### `sonosig_encode_file`

Embeds an already-signed proof into an audio file by appending a `SONOSIG1` proof block.

Input:

```json
{
  "inputPath": "samples/song.wav",
  "outputPath": "samples/song-sonosig.wav",
  "proofPath": "samples/song-proof.json"
}
```

Alternative: pass the proof object directly as `proof`.

Output includes:

- `outputPath`
- `sourceBytes`
- `proofBytes`
- `totalBytes`

Agent notes:

- This tool does not sign the proof.
- If `outputPath` is omitted, the server writes `*-sonosig.ext`.
- Treat output files as user artifacts and avoid overwriting source files unless explicitly requested.

### `sonosig_verify_file`

Reads a SonoSig proof from an encoded file and validates its payload.

Input:

```json
{
  "inputPath": "samples/song-sonosig.wav"
}
```

Output includes:

- `proof`
- `computed.audio_hash`
- `computed.audio_fingerprint`
- `audioHashStatus`

`audioHashStatus` values:

| Status | Meaning |
|---|---|
| `verified` | WAV/AIFF audio hash matches the embedded proof. |
| `changed_after_encoding` | A WAV/AIFF hash was computed but does not match the proof. |
| `not_checked` | Exact audio hash was not computed, usually because the file is not supported PCM WAV/AIFF. |

Agent notes:

- Verification currently expects 16-bit PCM WAV or AIFF for the audio-hash comparison.
- The tool can still read a tagged proof block when exact PCM verification is not possible.

### `sonosig_submit_pacstac`

Registers a signed SonoSig proof with PacStac using `PACSTAC_API_KEY`.

Input from encoded file:

```json
{
  "inputPath": "samples/song-sonosig.wav",
  "origin": "https://sonosig.com"
}
```

Input from proof JSON:

```json
{
  "proofPath": "samples/song-proof.json",
  "origin": "https://sonosig.com"
}
```

Agent notes:

- Use this only after verifying the proof payload is the intended one.
- Preserve PacStac response fields such as claim ID, status, and idempotency state in your final answer or local receipt.
- If PacStac returns a duplicate/idempotent response, treat it as an existing registration rather than an error unless the user is disputing the claim.

### `sonosig_prepare_ens_record`

Builds the ENS text-record key/value pair without sending a transaction.

Input:

```json
{
  "claimId": "sonosig:sha256:..."
}
```

Output:

```json
{
  "key": "com.sonosig",
  "value": "{\"v\":1,\"latest\":\"sonosig:sha256:...\"}"
}
```

Agent notes:

- Prefer this tool before any on-chain action.
- Use it when a user wants to manually update ENS through ENS Manager.
- SonoSig proofs do not contain a PacStac claim ID by default, so pass `claimId` explicitly unless reading from a proof object that already has `pacstacClaimId`.

### `sonosig_submit_ens`

Writes the ENS `com.sonosig` text record on Ethereum mainnet.

Input:

```json
{
  "ensName": "example.eth",
  "claimId": "sonosig:sha256:...",
  "confirm": true
}
```

Output includes:

- `ensName`
- `resolver`
- `hash`
- `receiptStatus`
- `key`
- `value`

Agent notes:

- This is an on-chain write and can spend ETH for gas.
- The tool refuses to send unless `confirm` is exactly `true`.
- Only use it after the user explicitly asks to submit the ENS update.
- The configured private key must control or manage the ENS name.
- If receipt polling times out, preserve the transaction hash and instruct the user to check the explorer or retry receipt status later.

## Recommended Agent Workflows

### Verify an encoded file

1. Call `sonosig_verify_file` with `inputPath`.
2. Report:
   - wallet
   - `audio_hash`
   - `audio_fingerprint`
   - signature/proof validity if returned
   - `audioHashStatus`
3. Explain that SonoSig verifies technical provenance signals, not legal copyright ownership.

### Encode a signed proof

1. Confirm the user already has a signed proof payload.
2. Call `sonosig_encode_file` with `inputPath` and either `proofPath` or `proof`.
3. Return the output path and byte summary.
4. Recommend verifying the output with `sonosig_verify_file`.

### Register with PacStac

1. Verify or load the proof.
2. Call `sonosig_submit_pacstac`.
3. Preserve the claim ID and response body.
4. Optionally call `sonosig_prepare_ens_record` for a future ENS pointer.

### Prepare ENS without sending a transaction

1. Confirm the PacStac claim ID.
2. Call `sonosig_prepare_ens_record`.
3. Give the user the key/value pair:
   - key: `com.sonosig`
   - value: `{"v":1,"latest":"..."}`

### Submit ENS on-chain

1. Confirm the user explicitly wants an on-chain ENS update.
2. Confirm the configured wallet controls or manages the ENS name.
3. Call `sonosig_prepare_ens_record` first if helpful.
4. Call `sonosig_submit_ens` with `confirm: true`.
5. Return the transaction hash and receipt status.

## Safety Rules for Agents

- Never ask users for seed phrases, private keys, passwords, or full payment card numbers.
- Do not claim SonoSig proves legal copyright ownership.
- Do not submit ENS writes unless the user explicitly approves the write.
- Do not retry on-chain writes blindly. Check whether a transaction hash already exists.
- Do not overwrite user files unless the requested output path is explicit.
- Do not expose `PACSTAC_API_KEY`, private keys, or raw env files in user-visible output.
- Treat PacStac and ENS records as public discovery signals.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| MCP client cannot start server | Wrong `cwd`, dependencies missing, or `npm` unavailable. | Run `npm install`, then `npm run mcp:stdio` from repo root. |
| `PACSTAC_API_KEY is not configured` | Missing key in env. | Add it to `.env.local` or process environment. |
| `Proof payload is missing string field ...` | Unsigned or malformed proof JSON. | Generate a signed proof through SonoSig Create first. |
| `No SonoSig watermark header found` | File is original audio or proof was stripped. | Verify the `*-sonosig` output file. |
| `Verification currently expects 16-bit PCM WAV audio` | Exact audio-hash check only supports PCM WAV/AIFF. | Use a supported export or treat proof extraction separately from audio-hash verification. |
| `This ENS name has no resolver configured` | ENS name cannot accept text records yet. | Configure a resolver in ENS Manager. |
| `confirm=true is required` | Agent attempted ENS write without explicit confirmation. | Ask user to confirm before sending an on-chain transaction. |
| `BASE_X402_WALLET_PUBLIC_KEY does not match` | Safety mismatch between expected and actual configured key. | Fix env vars before sending ENS transactions. |

## Smoke Test

The server was checked with an MCP initialize and `tools/list` request. It returned protocol version `2024-11-05` and these tools:

- `sonosig_encode_file`
- `sonosig_verify_file`
- `sonosig_submit_pacstac`
- `sonosig_prepare_ens_record`
- `sonosig_submit_ens`

This confirms the stdio server starts and advertises the expected tool surface.
