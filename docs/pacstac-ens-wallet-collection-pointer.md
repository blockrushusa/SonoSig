# PacStac ENS Wallet Collection Pointer

## Summary

SonoSig will write one ENS text record per creator ENS name:

```txt
com.sonosig = pacstac:wallet:0x1234567890abcdef1234567890abcdef12345678
```

This record points to a PacStac wallet-level SonoSig collection, not to a single song or claim. The reason is that an ENS text key has one value, while a creator may register many songs.

## What SonoSig Will Do

When a creator posts to ENS, SonoSig will:

1. Resolve the selected ENS name and resolver.
2. Write the `com.sonosig` text record on Ethereum mainnet.
3. Set the value to `pacstac:wallet:<lowercase_evm_address>`.
4. Continue registering individual song proofs with PacStac under the `sonosig` namespace.

Example:

```txt
com.sonosig = pacstac:wallet:0xf2f4ca192065c452b3a1da181146f766e5942476
```

The wallet address should be the wallet that signed the SonoSig proof and owns the PacStac SonoSig claim collection.

## What PacStac Needs To Support

PacStac should treat `pacstac:wallet:<address>` as a collection pointer.

Recommended behavior:

| Requirement | Details |
|---|---|
| URI scheme | Accept `pacstac:wallet:0x...` as a canonical PacStac collection pointer. |
| Address normalization | Accept checksum or lowercase input, normalize internally, and return checksum display addresses where useful. |
| Collection lookup | Resolve the wallet to all active SonoSig claims registered by that wallet. |
| Namespace filtering | Return `sonosig` namespace claims by default for this pointer. |
| Status filtering | Distinguish verified, pending, revoked, hidden, disputed, duplicate, and failed claims. |
| Public URL | Provide a human-readable PacStac page for the collection. |
| API URL | Provide a machine-readable endpoint for agents and apps. |
| Pagination | Support pagination or cursors for large catalogs. |
| Sorting | Default to newest verified claim first, with optional sort by title, issued date, claim date, or trust score. |
| Attestation | If available, include PacStac signed attestations per claim or for the collection response. |

## Requested PacStac API Shape

Recommended endpoint:

```http
GET /api/v1/namespaces/sonosig/wallets/{wallet}/claims
```

Recommended response:

```json
{
  "namespace": "sonosig",
  "wallet": "0xf2F4ca192065c452B3A1da181146F766E5942476",
  "pointer": "pacstac:wallet:0xf2f4ca192065c452b3a1da181146f766e5942476",
  "status": "active",
  "total": 2,
  "claims": [
    {
      "claimId": "sonosig:sha256:...",
      "status": "verified",
      "audioHash": "sha256:...",
      "audioFingerprint": "sha256:...",
      "wallet": "0xf2F4ca192065c452B3A1da181146F766E5942476",
      "ens": "example.eth",
      "song": {
        "title": "Example Song",
        "artist": "Example Artist",
        "isrc": "US..."
      },
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z",
      "url": "https://pacstac.com/..."
    }
  ],
  "links": {
    "html": "https://pacstac.com/sonosig/wallet/0xf2f4ca192065c452b3a1da181146f766e5942476",
    "api": "https://pacstac.com/api/v1/namespaces/sonosig/wallets/0xf2f4ca192065c452b3a1da181146f766e5942476/claims"
  }
}
```

## ENS Resolution Flow For Agents

Agents should be able to:

1. Read `com.sonosig` from an ENS name.
2. Detect `pacstac:wallet:<address>`.
3. Query PacStac for the wallet collection.
4. Show all SonoSig claims for that creator wallet.
5. Verify a specific audio file by matching its embedded SonoSig proof against the PacStac claim list.

## Backward Compatibility

Earlier SonoSig builds used a single-claim JSON value:

```json
{"v":1,"latest":"sonosig:sha256:..."}
```

PacStac does not need to support that as the primary design, but supporting it during migration would help older ENS records. Recommended migration behavior:

| Existing ENS value | Interpretation |
|---|---|
| `pacstac:wallet:0x...` | Wallet collection pointer. Preferred. |
| `{"v":1,"latest":"sonosig:sha256:..."}` | Legacy single-claim pointer. Resolve the claim, then show its wallet collection if possible. |

## Open Questions For PacStac

Ask PacStac to confirm:

1. Can `pacstac:wallet:<address>` be treated as an official PacStac URI?
2. What public URL should this pointer map to?
3. What API endpoint should SonoSig and agents call to resolve the collection?
4. Should the collection include only verified claims, or all claim statuses with filters?
5. Should PacStac sign the collection response or only individual claims?
6. Can the response include song metadata, claim status, attestation hash, and public claim URLs?
7. Should PacStac support legacy `{ "v": 1, "latest": "..." }` ENS records during migration?

## Recommended Message To PacStac Dev

SonoSig is moving its ENS `com.sonosig` record from a single-claim pointer to a wallet collection pointer:

```txt
com.sonosig = pacstac:wallet:<evm-wallet-address>
```

Can PacStac support this as an official URI that resolves to all `sonosig` namespace claims registered by that wallet? We need a public collection URL and a machine-readable API endpoint that returns the wallet, pointer, claim count, claim list, statuses, song metadata, hashes, attestation details, and pagination. This lets one ENS text record represent an entire creator catalog instead of one song.
