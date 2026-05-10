import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, getDocFromServer, doc, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Check protocol for APK/WebView compatibility
const isFileProtocol = window.location.protocol === 'file:';
if (isFileProtocol) {
  console.warn("Running on file:// protocol. Firebase might have issues with persistence and auth.");
  (window as any).firebaseProtocolWarning = true;
}

// Use initializeFirestore to force long polling, which is more stable in WebViews/APKs
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // Use memory persistence if on file protocol to avoid IndexedDB issues in some WebViews
  localCache: isFileProtocol ? undefined : undefined 
}, firebaseConfig.firestoreDatabaseId);

export const storage = getStorage(app);

export default app;

// Connection test
async function testConnection() {
  try {
    // Try to get a document to verify connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful.");
    (window as any).firebaseStatus = 'connected';
  } catch (error: any) {
    console.error("Firestore connection test failed:", error);
    (window as any).firebaseStatus = 'error';
    (window as any).firebaseError = error.message;
    
    if (error.message.includes('the client is offline')) {
      console.error("Please check your internet connection.");
    } else if (error.message.includes('permission-denied')) {
      console.error("Firestore permissions denied. Check your rules.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
