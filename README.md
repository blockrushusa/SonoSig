# Sonosig

Next.js application bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
3. Enable the Authentication providers you want to use. The starter panel expects email/password and anonymous sign-in.
4. Create a Firestore database, then deploy rules with `npm run firebase:deploy:rules -- --project <project-id>`.
5. For local Firebase services, set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` and run `npm run firebase:emulators -- --project <project-id>`.

Firebase App Hosting uses `apphosting.yaml` from the repository root. Connect the GitHub repo to an App Hosting backend in Firebase, then pushes to the live branch can trigger rollouts.
