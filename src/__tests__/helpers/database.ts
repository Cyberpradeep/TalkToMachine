import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { DatabaseConnection } from '../../config/database';

let mongoServer: MongoMemoryServer;
let dbConnection: DatabaseConnection;

export const setupTestDatabase = async (): Promise<void> => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect to the in-memory database
  dbConnection = DatabaseConnection.getInstance();
  await dbConnection.connect({ uri: mongoUri });
};

export const teardownTestDatabase = async (): Promise<void> => {
  // Clean up database connection
  if (dbConnection) {
    await dbConnection.disconnect();
  }

  // Stop the in-memory MongoDB instance
  if (mongoServer) {
    await mongoServer.stop();
  }
};

export const clearTestDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
};

export const createTestObjectId = (): mongoose.Types.ObjectId => {
  return new mongoose.Types.ObjectId();
};

export const createTestEmbedding = (dimension: number = 384): number[] => {
  const embedding = [];
  for (let i = 0; i < dimension; i++) {
    embedding.push(Math.random() * 2 - 1); // Random values between -1 and 1
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
};