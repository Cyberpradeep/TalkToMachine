// Mock functions must be declared before the mock
const mockInitializeApp = jest.fn();
const mockCredentialCert = jest.fn();
const mockVerifyIdToken = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockSendMulticast = jest.fn();

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  initializeApp: mockInitializeApp,
  credential: {
    cert: mockCredentialCert,
  },
}));

jest.mock('../../config/environment');
jest.mock('../../utils/logger');

import admin from 'firebase-admin';
import { 
  initializeFirebase, 
  getFirebaseAdmin, 
  verifyIdToken, 
  getFirebaseUserByEmail,
  sendFCMNotification 
} from '../../config/firebase';
import { config } from '../../config/environment';

describe('Firebase Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Firebase app instance
    (initializeFirebase as any).firebaseApp = null;
    
    // Default config mock
    (config as any) = {
      env: 'production',
      auth: {
        allowNoAuth: false,
        firebase: {
          projectId: 'test-project',
          privateKey: 'test-private-key',
          clientEmail: 'test@test-project.iam.gserviceaccount.com',
        },
      },
    };
  });

  describe('initializeFirebase', () => {
    it('should initialize Firebase Admin SDK with valid configuration', () => {
      const mockApp = { name: 'test-app' } as any;
      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);

      const result = initializeFirebase();

      expect(mockCredentialCert).toHaveBeenCalledWith({
        projectId: 'test-project',
        privateKey: 'test-private-key',
        clientEmail: 'test@test-project.iam.gserviceaccount.com',
      });
      expect(mockInitializeApp).toHaveBeenCalledWith({
        credential: {},
        projectId: 'test-project',
      });
      expect(result).toBe(mockApp);
    });

    it('should skip initialization in development mode with ALLOW_NO_AUTH', () => {
      (config as any).env = 'development';
      (config as any).auth.allowNoAuth = true;

      const result = initializeFirebase();

      expect(mockInitializeApp).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw error if Firebase configuration is missing', () => {
      (config as any).auth.firebase.projectId = undefined;

      expect(() => initializeFirebase()).toThrow('Missing required Firebase configuration');
      expect(mockInitializeApp).not.toHaveBeenCalled();
    });

    it('should return existing app instance if already initialized', () => {
      const mockApp = { name: 'test-app' } as any;
      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);

      // First initialization
      const result1 = initializeFirebase();
      // Second call should return same instance
      const result2 = initializeFirebase();

      expect(mockInitializeApp).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2);
    });

    it('should handle Firebase initialization errors', () => {
      mockCredentialCert.mockReturnValue({} as any);
      mockInitializeApp.mockImplementation(() => {
        throw new Error('Firebase initialization failed');
      });

      expect(() => initializeFirebase()).toThrow('Firebase initialization failed');
    });
  });

  describe('getFirebaseAdmin', () => {
    it('should return existing Firebase app instance', () => {
      const mockApp = { name: 'test-app' } as any;
      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);

      // Initialize first
      initializeFirebase();
      
      // Get instance
      const result = getFirebaseAdmin();

      expect(result).toBe(mockApp);
      expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    });

    it('should initialize Firebase if not already initialized', () => {
      const mockApp = { name: 'test-app' } as any;
      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);

      const result = getFirebaseAdmin();

      expect(result).toBe(mockApp);
      expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyIdToken', () => {
    it('should verify valid ID token', async () => {
      const mockApp = {
        auth: () => ({
          verifyIdToken: mockVerifyIdToken,
        }),
      } as any;

      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);
      mockVerifyIdToken.mockResolvedValue({
        uid: 'test-uid',
        email: 'test@example.com',
      });

      const result = await verifyIdToken('valid-token');

      expect(result).toEqual({
        uid: 'test-uid',
        email: 'test@example.com',
      });
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw error for invalid token', async () => {
      const mockApp = {
        auth: () => ({
          verifyIdToken: mockVerifyIdToken,
        }),
      } as any;

      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await expect(verifyIdToken('invalid-token')).rejects.toThrow('Invalid token');
    });

    it('should throw error if Firebase not initialized', async () => {
      (config as any).env = 'development';
      (config as any).auth.allowNoAuth = true;

      await expect(verifyIdToken('token')).rejects.toThrow('Firebase not initialized');
    });
  });

  describe('getFirebaseUserByEmail', () => {
    it('should get user by email', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
      };

      const mockApp = {
        auth: () => ({
          getUserByEmail: mockGetUserByEmail,
        }),
      } as any;

      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);
      mockGetUserByEmail.mockResolvedValue(mockUser);

      const result = await getFirebaseUserByEmail('test@example.com');

      expect(result).toBe(mockUser);
      expect(mockGetUserByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw error if user not found', async () => {
      const mockApp = {
        auth: () => ({
          getUserByEmail: mockGetUserByEmail,
        }),
      } as any;

      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);
      mockGetUserByEmail.mockRejectedValue(new Error('User not found'));

      await expect(getFirebaseUserByEmail('nonexistent@example.com')).rejects.toThrow('User not found');
    });
  });

  describe('sendFCMNotification', () => {
    it('should send FCM notification successfully', async () => {
      const mockResponse = {
        successCount: 2,
        failureCount: 0,
      };

      const mockApp = {
        messaging: () => ({
          sendEachForMulticast: mockSendMulticast,
        }),
      } as any;

      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);
      mockSendMulticast.mockResolvedValue(mockResponse);

      const tokens = ['token1', 'token2'];
      const title = 'Test Title';
      const body = 'Test Body';
      const data = { key: 'value' };

      const result = await sendFCMNotification(tokens, title, body, data);

      expect(result).toBe(mockResponse);
      expect(mockSendMulticast).toHaveBeenCalledWith({
        notification: { title, body },
        data,
        tokens,
      });
    });

    it('should send notification without data', async () => {
      const mockResponse = {
        successCount: 1,
        failureCount: 0,
      };

      const mockApp = {
        messaging: () => ({
          sendEachForMulticast: mockSendMulticast,
        }),
      } as any;

      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);
      mockSendMulticast.mockResolvedValue(mockResponse);

      const tokens = ['token1'];
      const title = 'Test Title';
      const body = 'Test Body';

      const result = await sendFCMNotification(tokens, title, body);

      expect(result).toBe(mockResponse);
      expect(mockSendMulticast).toHaveBeenCalledWith({
        notification: { title, body },
        data: undefined,
        tokens,
      });
    });

    it('should handle FCM sending errors', async () => {
      const mockApp = {
        messaging: () => ({
          sendEachForMulticast: mockSendMulticast,
        }),
      } as any;

      mockInitializeApp.mockReturnValue(mockApp);
      mockCredentialCert.mockReturnValue({} as any);
      mockSendMulticast.mockRejectedValue(new Error('FCM error'));

      await expect(sendFCMNotification(['token1'], 'Title', 'Body')).rejects.toThrow('FCM error');
    });

    it('should throw error if Firebase not initialized', async () => {
      (config as any).env = 'development';
      (config as any).auth.allowNoAuth = true;

      await expect(sendFCMNotification(['token1'], 'Title', 'Body')).rejects.toThrow('Firebase not initialized');
    });
  });
});