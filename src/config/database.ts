import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export interface DatabaseConfig {
  uri: string;
  options?: mongoose.ConnectOptions;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(config: DatabaseConfig): Promise<void> {
    try {
      if (this.isConnected) {
        logger.info('Database already connected');
        return;
      }

      const defaultOptions: mongoose.ConnectOptions = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      };

      const options = { ...defaultOptions, ...config.options };

      await mongoose.connect(config.uri, options);
      this.isConnected = true;

      logger.info('Database connected successfully');

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('Database connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('Database disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('Database reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw new DatabaseError('Database connection failed', error as Error);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (!this.isConnected) {
        return;
      }

      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw new DatabaseError('Database disconnection failed', error as Error);
    }
  }

  public isHealthy(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  public getConnectionState(): string {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[mongoose.connection.readyState as keyof typeof states] || 'unknown';
  }

  public async ping(): Promise<boolean> {
    try {
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      logger.error('Database ping failed:', error);
      return false;
    }
  }
}

export class DatabaseError extends Error {
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
    this.originalError = originalError;

    if (originalError?.stack) {
      this.stack = originalError.stack;
    }
  }
}

// Utility functions for common database operations
export const withTransaction = async <T>(
  operation: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }

      logger.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw new DatabaseError(`Operation failed after ${maxRetries} attempts`, lastError!);
};

// Export convenience function for backward compatibility
export const connectDatabase = async (): Promise<void> => {
  const config = process.env.MONGODB_URI || 'mongodb://localhost:27017/talktomachine';
  const db = DatabaseConnection.getInstance();
  await db.connect({ uri: config });
};