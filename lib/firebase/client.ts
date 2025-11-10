import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missingKey = Object.entries(firebaseConfig).find(([, value]) => !value);

if (missingKey) {
  // eslint-disable-next-line no-console
  console.warn(`Firebase config is missing ${missingKey[0]}. Check your environment variables.`);
}

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
