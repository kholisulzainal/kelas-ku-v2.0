import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';

export interface FirebaseCustomConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const FIREBASE_CONFIG_STORAGE_KEY = 'custom_firebase_config';
const FIREBASE_DISCONNECTED_KEY = 'firebase_disconnected';

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;

export function isFirebaseDisconnected(): boolean {
  return localStorage.getItem(FIREBASE_DISCONNECTED_KEY) === 'true';
}

export function getCustomFirebaseConfig(): FirebaseCustomConfig | null {
  if (isFirebaseDisconnected()) {
    return null;
  }
  try {
    const saved = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.projectId) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading custom firebase config:', e);
  }
  return null;
}

export async function resetFirebaseInstances(): Promise<void> {
  try {
    const apps = getApps();
    for (const app of apps) {
      try {
        await deleteApp(app);
      } catch (e) {
        console.warn('Error deleting individual Firebase app:', e);
      }
    }
  } catch (e) {
    console.warn('Error resetting Firebase apps:', e);
  } finally {
    appInstance = null;
    firestoreInstance = null;
  }
}

export async function saveCustomFirebaseConfig(config: FirebaseCustomConfig): Promise<void> {
  const cleanConfig: FirebaseCustomConfig = {
    projectId: (config.projectId || '').trim(),
    apiKey: (config.apiKey || '').trim(),
    appId: (config.appId || '').trim(),
    authDomain: (config.authDomain || '').trim(),
    storageBucket: (config.storageBucket || '').trim(),
    messagingSenderId: (config.messagingSenderId || '').trim()
  };
  
  if (cleanConfig.projectId) {
    localStorage.removeItem(FIREBASE_DISCONNECTED_KEY);
    localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(cleanConfig));
  } else {
    localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
    localStorage.setItem(FIREBASE_DISCONNECTED_KEY, 'true');
  }
  await resetFirebaseInstances();
}

export async function clearCustomFirebaseConfig(): Promise<void> {
  localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
  localStorage.setItem(FIREBASE_DISCONNECTED_KEY, 'true');
  await resetFirebaseInstances();
}

export function getFirebaseApp(): FirebaseApp | null {
  if (isFirebaseDisconnected()) {
    return null;
  }
  if (appInstance) {
    return appInstance;
  }
  const customConfig = getCustomFirebaseConfig();
  const existingApps = getApps();
  
  // Prefer custom user config if present
  const config = customConfig || (
    import.meta.env.VITE_FIREBASE_PROJECT_ID ? {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
    } : null
  );

  if (!config || !config.projectId || !config.projectId.trim()) {
    return null;
  }

  const cleanProjectId = config.projectId.trim();

  // Normalize apiKey
  let sanitizedApiKey = config.apiKey ? config.apiKey.trim() : '';
  if (!sanitizedApiKey) {
    // Generate a valid base64-like placeholder key for Firestore initialization
    sanitizedApiKey = `AIzaSy${btoa(cleanProjectId).replace(/[^a-zA-Z0-9]/g, '').padEnd(33, '0').slice(0, 33)}`;
  }

  const finalConfig = {
    apiKey: sanitizedApiKey,
    projectId: cleanProjectId,
    authDomain: config.authDomain || `${cleanProjectId}.firebaseapp.com`,
    storageBucket: config.storageBucket || `${cleanProjectId}.appspot.com`,
    messagingSenderId: config.messagingSenderId || '1234567890',
    appId: config.appId || `1:1234567890:web:${cleanProjectId}`
  };

  try {
    if (!existingApps.length) {
      appInstance = initializeApp(finalConfig);
    } else {
      appInstance = existingApps[0];
    }
    return appInstance;
  } catch (e) {
    console.error('Error initializing Firebase App:', e);
    return null;
  }
}

export function getDb(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  const app = getFirebaseApp();
  if (app) {
    try {
      // Try to initialize with long polling first to bypass iframe/firewall blocks
      try {
        firestoreInstance = initializeFirestore(app, {
          experimentalForceLongPolling: true,
          ignoreUndefinedProperties: true
        });
      } catch (e) {
        // If already initialized, fetch the existing instance
        try {
          firestoreInstance = getFirestore(app);
        } catch (initErr) {
          console.warn('Fallback getFirestore notice:', initErr);
          firestoreInstance = getFirestore();
        }
      }
      return firestoreInstance;
    } catch (e) {
      console.error('Error initializing Firestore:', e);
      return null;
    }
  }
  return null;
}
