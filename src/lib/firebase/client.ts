import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

function shouldUseEmulators() {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
}

function resolveAuthDomain() {
  if (typeof window === "undefined" || shouldUseEmulators()) {
    return firebaseConfig.authDomain;
  }

  const configuredAuthDomain = firebaseConfig.authDomain;
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isFirebaseDefaultDomain = configuredAuthDomain?.endsWith(
    ".firebaseapp.com",
  );

  if (
    window.location.protocol === "https:" &&
    configuredAuthDomain &&
    isFirebaseDefaultDomain &&
    !isLocalhost
  ) {
    return window.location.host;
  }

  return configuredAuthDomain;
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) {
    return null;
  }

  return getApps().length
    ? getApp()
    : initializeApp({
        ...firebaseConfig,
        authDomain: resolveAuthDomain(),
      });
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  const auth = getAuth(app);

  if (
    typeof window !== "undefined" &&
    shouldUseEmulators() &&
    !authEmulatorConnected
  ) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    authEmulatorConnected = true;
  }

  return auth;
}

export function getFirebaseDb(): Firestore | null {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  const db = getFirestore(app);

  if (
    typeof window !== "undefined" &&
    shouldUseEmulators() &&
    !firestoreEmulatorConnected
  ) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    firestoreEmulatorConnected = true;
  }

  return db;
}
