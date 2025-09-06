import admin from 'firebase-admin';
import { config } from './environment';
import { logger } from '../utils/logger';

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebase(): admin.app.App | null {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Skip Firebase initialization in development if ALLOW_NO_AUTH is true
    if (config.env === 'development' && config.auth.allowNoAuth) {
      logger.info('Firebase initialization skipped - ALLOW_NO_AUTH is enabled');
      return null;
    }

    // Validate required Firebase configuration
    if (!config.auth.firebase.projectId || 
        !config.auth.firebase.privateKey || 
        !config.auth.firebase.clientEmail) {
      throw new Error('Missing required Firebase configuration');
    }

    // Initialize Firebase Admin SDK
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.auth.firebase.projectId,
        privateKey: config.auth.firebase.privateKey,
        clientEmail: config.auth.firebase.clientEmail,
      }),
      projectId: config.auth.firebase.projectId,
    });

    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
}

/**
 * Get Firebase Admin instance
 */
export function getFirebaseAdmin(): admin.app.App | null {
  if (!firebaseApp) {
    return initializeFirebase();
  }
  return firebaseApp;
}

/**
 * Verify Firebase ID token
 */
export async function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  try {
    const app = getFirebaseAdmin();
    if (!app) {
      throw new Error('Firebase not initialized');
    }
    
    const decodedToken = await app.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    logger.error('Failed to verify Firebase ID token:', error);
    throw error;
  }
}

/**
 * Get user by email from Firebase
 */
export async function getFirebaseUserByEmail(email: string): Promise<admin.auth.UserRecord> {
  try {
    const app = getFirebaseAdmin();
    if (!app) {
      throw new Error('Firebase not initialized');
    }
    
    const userRecord = await app.auth().getUserByEmail(email);
    return userRecord;
  } catch (error) {
    logger.error('Failed to get Firebase user by email:', error);
    throw error;
  }
}

/**
 * Send FCM notification
 */
export async function sendFCMNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<admin.messaging.BatchResponse> {
  try {
    const app = getFirebaseAdmin();
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    const message: admin.messaging.MulticastMessage = {
      notification: {
        title,
        body,
      },
      data,
      tokens,
    };

    const response = await app.messaging().sendEachForMulticast(message);
    logger.info(`FCM notification sent to ${tokens.length} tokens, ${response.successCount} successful`);
    
    return response;
  } catch (error) {
    logger.error('Failed to send FCM notification:', error);
    throw error;
  }
}