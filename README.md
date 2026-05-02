# SonoSig

SonoSig is an agent-accessible identity and trust system for media, starting
with audio. Creators can encode a wallet-signed proof into an audio file,
verify embedded proofs later, register discovery signals with PacStac, and
publish an ENS pointer to their PacStac wallet collection.

## Tech Stack

- **App framework:** Next.js 16 App Router with React 19 and TypeScript.
- **Styling:** Tailwind CSS 4 with component-level utility classes in `src/components`.
- **Authentication and data:** Firebase Authentication, Firebase Admin SDK, and Cloud Firestore for user/admin data and app settings.
- **Wallet integration:** RainbowKit, wagmi, and viem for wallet connection, SIWE signatures, ENS reads/writes, transaction receipts, and EVM utilities.
- **Audio proof engine:** Browser-side audio decoding, metadata extraction, waveform generation, SONOSIG1 payload embedding, and verification in `src/lib/audio-watermark.ts` and related components.
- **Provenance services:** PacStac claim registration, ENS `com.sonosig` text-record publishing, and local web3 transaction history for verification status.
- **x402 payments:** `@x402/fetch` and `@x402/evm` support paid PacStac API reads through the Base x402 wallet. PacStac claim creation still falls back to `PACSTAC_API_KEY` unless PacStac advertises x402 for the claim-write endpoint.
- **0G Storage:** Optional server-side receipt mirroring with `@0gfoundation/0g-storage-ts-sdk` and `ethers`. When enabled in Admin API config and backed by `ZEROG_STORAGE_PRIVATE_KEY`, the Post Proof modal can upload a compact registration receipt to 0G Storage.
- **Agent integration:** Model Context Protocol server in `scripts/sonosig-mcp-server.mjs` for encode, verify, PacStac registration, and ENS workflows.
- **Agentic Scan:** CLI, MCP, and admin-gated web agent for finding SonoSig-encoded audio files on public websites. Specific page URLs are scanned as one page by default; root URLs are crawled as sites.
- **Deployment and ops:** Firebase App Hosting, Firebase CLI scripts, Firestore rules deployment, and Porkbun DNS sync scripts.

Developer docs are available in the app at `/docs`, with encoding details at `/docs/encoding` and ENS/PacStac discovery details at `/docs/ens`. The generated sitemap is served by the Next.js App Router at `/sitemap.xml`.

For MCP client setup, tool behavior, and agent safety rules, see [SonoSig MCP Agent Guide](./docs/sonosig-mcp-agent-guide.md).
For website scanner architecture and usage, see [SonoSig Website Scanner Agent Plan](./docs/sonosig-website-scanner-agent-plan.md).
For the completed scanner implementation checklist, see [SonoSig Website Scanner Implementation TODO](./docs/sonosig-website-scanner-implementation-todo.md).
For the current audio proof container and embedding behavior, see [SonoSig Audio Proof Format](./audio-watermark.md).

## How It's Made

SonoSig is built with Next.js 16, React 19, TypeScript, Tailwind, Firebase Auth/Firestore, RainbowKit/wagmi/viem, and a Node MCP server. The browser handles audio decoding, proof creation, waveform UI, wallet signing, and SONOSIG1 embedding. Server routes handle PacStac registration, ENS/RPC lookups, transaction receipt checks, admin config, and OpenAI-powered support chat. PacStac provides discovery/indexing for signed media claims, ENS provides creator-controlled public pointers, x402 supports paid PacStac API reads on Base, and MCP lets agents verify files, register proofs, prepare ENS records, and run Agentic Scan. The useful hack: audio proofs stay portable inside the file, while ENS points to a wallet-level PacStac collection so one text record can represent a whole catalog instead of one song.

## 0G Storage

SonoSig can optionally use the 0G network as a decentralized storage mirror for
registration receipts. This does not replace the embedded SonoSig proof,
PacStac registration, or ENS pointer. Instead, it gives a creator another
portable receipt location for the same claim context.

When 0G Storage is enabled in `/admin/api-config`, the Post Proof modal shows a
`0G Storage` checkbox. If selected, the server uploads a compact JSON receipt to
0G Storage after the selected PacStac and ENS actions run. The receipt includes
the SonoSig proof payload, posting metadata, PacStac registration details when
available, ENS transaction details when available, and the generated timestamp.
The browser receives the 0G root hash and transaction hash and can include them
in the downloaded registration JSON.

Important boundaries:

- The original audio file is not uploaded to 0G by this integration.
- Private keys stay server-side in environment variables or ignored local files.
- 0G receipt uploads require a funded EVM-compatible 0G Galileo Testnet wallet.
- 0G is optional; if it is disabled or unfunded, PacStac, ENS, verification, and
  local registration downloads continue to work.

The default testnet endpoints in `.env.example` are taken from the 0G Storage
SDK flow:

```env
ZEROG_STORAGE_RPC_URL=https://evmrpc-testnet.0g.ai
ZEROG_STORAGE_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai
ZEROG_STORAGE_NETWORK=0G Galileo Testnet
```

Generate or provide a dedicated server wallet, fund its public address with 0G
Galileo testnet gas, set `ZEROG_STORAGE_PRIVATE_KEY` in `.env.local` or the
hosting secret manager, then enable 0G Storage in the admin API config.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3050](http://localhost:3050) with your browser to see the result.

Run a public website scan for SonoSig-encoded audio:

```bash
npm run scan:website -- --url https://example.com --max-pages 25
npm run scan:website -- --url https://example.com/path/to/page --scan-scope page
```

Use `--scan-scope auto` by default. In auto mode, root URLs scan as sites and specific page URLs scan as a single page.

You can start editing the main page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Geist.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Firebase

This project is wired for Firebase Authentication, Cloud Firestore, local emulators, and Firebase App Hosting.

1. Create a Firebase project and web app in the Firebase console.
2. Copy `.env.example` to `.env.local` and fill in the `NEXT_PUBLIC_FIREBASE_*` values.
3. Enable Google Authentication. The header account control uses Google popup sign-in.
4. Create a Firestore database, then deploy rules with `npm run firebase:deploy:rules -- --project <project-id>`.
5. For local Firebase services, set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` and run `npm run firebase:emulators -- --project <project-id>`.

Firebase App Hosting uses `apphosting.yaml` from the repository root. Connect the GitHub repo to an App Hosting backend in Firebase, then pushes to the live branch can trigger rollouts.

For Safari and mobile auth notes, see [Firebase Auth on Safari and Mobile](./docs/firebase-auth-safari.md).

## Key Environment Notes

- `PACSTAC_API_KEY` is still required for SonoSig claim creation unless PacStac advertises x402 support for the claim-write endpoint.
- `BASE_X402_WALLET_PRIVATE_KEY` and `BASE_X402_WALLET_PUBLIC_KEY` configure the Base x402 wallet used for paid PacStac reads and admin wallet diagnostics.
- `BASE_RPC_URL` is preferred for Base balance checks. If it is missing or unavailable, the admin wallet status code falls back to Base's public RPC at `https://mainnet.base.org`.
- `EVM_MULTI_CHAIN_RPC_URL` and `ETHEREUM_RPC_URL` are used for ENS resolver checks, ENS text-record writes, and Ethereum transaction receipt lookups.
- `ZEROG_STORAGE_PRIVATE_KEY` enables optional server-side 0G Storage receipt uploads. `ZEROG_STORAGE_RPC_URL`, `ZEROG_STORAGE_INDEXER_RPC`, and `ZEROG_STORAGE_NETWORK` override the default 0G Galileo Testnet endpoints shown in `.env.example`.
- `OPENAI_API_KEY` and `OPENAI_VECTOR_STORE_ID` power the support chatbot when configured.
