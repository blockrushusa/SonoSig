import "server-only";

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type AppOptions,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) {
    return getApps()[0];
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

    return initializeApp({
      credential: cert(serviceAccount),
      ...(projectId ? { projectId } : {}),
      ...(getServiceAccountId(serviceAccount.client_email)
        ? { serviceAccountId: getServiceAccountId(serviceAccount.client_email) }
        : {}),
    });
  }

  const options: AppOptions = {};
  const serviceAccountId = getServiceAccountId();

  if (serviceAccountId) {
    options.credential = applicationDefault();
    options.serviceAccountId = serviceAccountId;
  }

  if (projectId) {
    options.projectId = projectId;
  }

  return initializeApp(options);
}

function getServiceAccountId(fallback?: string) {
  return (
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_ID ||
    process.env.FIREBASE_SERVICE_ACCOUNT_ID ||
    process.env.FIREBASE_CLIENT_EMAIL ||
    fallback ||
    undefined
  );
}

export const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
