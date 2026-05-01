# Sonosig

Next.js application bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Tech Stack

- **App framework:** Next.js 16 App Router with React 19 and TypeScript.
- **Styling:** Tailwind CSS 4 with component-level utility classes in `src/components`.
- **Authentication and data:** Firebase Authentication, Firebase Admin SDK, and Cloud Firestore for user/admin data and app settings.
- **Wallet integration:** RainbowKit, wagmi, and viem for wallet connection, SIWE signatures, ENS reads/writes, transaction receipts, and EVM utilities.
- **Audio proof engine:** Browser-side audio decoding, metadata extraction, waveform generation, SONOSIG1 payload embedding, and verification in `src/lib/audio-watermark.ts` and related components.
- **Provenance services:** PacStac claim registration, ENS `com.sonosig` text-record publishing, and local web3 transaction history for verification status.
- **x402 payments:** `@x402/fetch` and `@x402/evm` support paid PacStac API access through the Base x402 wallet.
- **Agent integration:** Model Context Protocol server in `scripts/sonosig-mcp-server.mjs` for encode, verify, PacStac registration, and ENS workflows.
- **Agentic Scan:** CLI, MCP, and admin agent for finding SonoSig-encoded audio files on public websites.
- **Deployment and ops:** Firebase App Hosting, Firebase CLI scripts, Firestore rules deployment, and Porkbun DNS sync scripts.

For MCP client setup, tool behavior, and agent safety rules, see [SonoSig MCP Agent Guide](./docs/sonosig-mcp-agent-guide.md).
For website scanner architecture and usage, see [SonoSig Website Scanner Agent Plan](./docs/sonosig-website-scanner-agent-plan.md).
For the completed scanner implementation checklist, see [SonoSig Website Scanner Implementation TODO](./docs/sonosig-website-scanner-implementation-todo.md).

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
```

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

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
