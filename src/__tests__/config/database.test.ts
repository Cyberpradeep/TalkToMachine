import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { DatabaseConnection, DatabaseError, withTransaction, retryOperation } from '../../config/database';

describe('Database Connection', () => {
  let mongoServer: MongoMemoryServer;
  let dbConnection: DatabaseConnection;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
  });

  afterAll(async () => {
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(() => {
    dbConnection = DatabaseConnection.getInstance();
  });

  afterEach(async () => {
    if (dbConnection && dbConnection.isHealthy()) {
      await dbConnection.disconnect();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DatabaseConnection.getInstance();
      const instance2 = DatabaseConnection.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Connection Management', () => {
    it('should connect to database successfully', async () => {
      const mongoUri = mongoServer.getUri();
      
      await dbConnection.connect({ uri: mongoUri });
      
      expect(dbConnection.isHealthy()).toBe(true);
      expect(dbConnection.getConnectionState()).toBe('connected');
    });

    it('should handle connection to invalid URI', async () => {
      const invalidUri = 'mongodb://invalid:27017/test';
      
      await expect(dbConnection.connect({ uri: invalidUri })).rejects.toThrow(DatabaseError);
    });

    it('should not reconnect if already connected', async () => {
      const mongoUri = mongoServer.getUri();
      
      await dbConnection.connect({ uri: mongoUri });
      const firstConnectionState = dbConnection.getConnectionState();
      
      await dbConnection.connect({ uri: mongoUri });
      const secondConnectionState = dbConnection.getConnectionState();
      
      expect(firstConnectionState).toBe(secondConnectionState);
      expect(dbConnection.isHealthy()).toBe(true);
    });

    it('should disconnect successfully', async () => {
      const mongoUri = mongoServer.getUri();
      
      await dbConnection.connect({ uri: mongoUri });
      expect(dbConnection.isHealthy()).toBe(true);
      
      await dbConnection.disconnect();
      expect(dbConnection.isHealthy()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      // Should not throw error
      await expect(dbConnection.disconnect()).resolves.not.toThrow();
    });
  });

  describe('Health Checks', () => {
    it('should ping database successfully when connected', async () => {
      const mongoUri = mongoServer.getUri();
      await dbConnection.connect({ uri: mongoUri });
      
      const pingResult = await dbConnection.ping();
      expect(pingResult).toBe(true);
    });

    it('should return false when pinging disconnected database', async () => {
      const pingResult = await dbConnection.ping();
      expect(pingResult).toBe(false);
    });

    it('should report correct connection states', async () => {
      expect(dbConnection.getConnectionState()).toBe('disconnected');
      
      const mongoUri = mongoServer.getUri();
      await dbConnection.connect({ uri: mongoUri });
      expect(dbConnection.getConnectionState()).toBe('connected');
      
      await dbConnection.disconnect();
      expect(dbConnection.getConnectionState()).toBe('disconnected');
    });
  });

  describe('Custom Options', () => {
    it('should accept custom connection options', async () => {
      const mongoUri = mongoServer.getUri();
      const customOptions = {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 3000,
      };
      
      await dbConnection.connect({ 
        uri: mongoUri, 
        options: customOptions 
      });
      
      expect(dbConnection.isHealthy()).toBe(true);
    });
  });
});

describe('Database Error', () => {
  it('should create error with message', () => {
    const error = new DatabaseError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('DatabaseError');
  });

  it('should preserve original error', () => {
    const originalError = new Error('Original error');
    const dbError = new DatabaseError('Database error', originalError);
    
    expect(dbError.originalError).toBe(originalError);
    expect(dbError.stack).toBe(originalError.stack);
  });
});

describe('Transaction Utilities', () => {
  let mongoServer: MongoMemoryServer;
  let dbConnection: DatabaseConnection;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    dbConnection = DatabaseConnection.getInstance();
    await dbConnection.connect({ uri: mongoServer.getUri() });
  });

  afterAll(async () => {
    await dbConnection.disconnect();
    await mongoServer.stop();
  });

  describe('withTransaction', () => {
    it('should execute operation within transaction', async () => {
      const result = await withTransaction(async (session) => {
        expect(session).toBeDefined();
        return 'success';
      });
      
      expect(result).toBe('success');
    });

    it('should rollback transaction on error', async () => {
      await expect(withTransaction(async (session) => {
        throw new Error('Test error');
      })).rejects.toThrow('Test error');
    });
  });

  describe('retryOperation', () => {
    it('should succeed on first attempt', async () => {
      let attempts = 0;
      
      const result = await retryOperation(async () => {
        attempts++;
        return 'success';
      }, 3, 10);
      
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      
      const result = await retryOperation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      }, 3, 10);
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      let attempts = 0;
      
      await expect(retryOperation(async () => {
        attempts++;
        throw new Error('Persistent failure');
      }, 3, 10)).rejects.toThrow(DatabaseError);
      
      expect(attempts).toBe(3);
    });

    it('should use default retry parameters', async () => {
      let attempts = 0;
      
      const result = await retryOperation(async () => {
        attempts++;
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });
  });
});