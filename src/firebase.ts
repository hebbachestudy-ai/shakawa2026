import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getDocFromServer,
  doc,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAR55z3_7fDco5Lv9uoze_IFZbaCEBi2sU",
  authDomain: "gen-lang-client-0320815828.firebaseapp.com",
  projectId: "gen-lang-client-0320815828",
  storageBucket: "gen-lang-client-0320815828.firebasestorage.app",
  messagingSenderId: "1081365990604",
  appId: "1:1081365990604:web:968fb01be8c74495904669",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const storage = getStorage(app);

export default app;

async function testConnection() {
  if (typeof window === "undefined") return;

  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firestore connection test successful.");
    (window as any).firebaseStatus = "connected";
  } catch (error: any) {
    console.error("Firestore connection test failed:", error);

    (window as any).firebaseStatus = "error";
    (window as any).firebaseError = error?.message;

    if (error?.message?.includes("client is offline")) {
      console.error("Please check your internet connection.");
    } else if (error?.message?.includes("permission-denied")) {
      console.error("Firestore permissions denied. Check your Firebase rules.");
    }
  }
}

testConnection();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };

  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
