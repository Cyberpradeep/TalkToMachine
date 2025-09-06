import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  PORT: Joi.number()
    .port()
    .default(3000),
  
  MONGODB_URI: Joi.string()
    .uri()
    .required()
    .description('MongoDB connection string'),
  
  CORS_ORIGINS: Joi.string()
    .default('http://localhost:3000,http://localhost:5173')
    .description('Comma-separated list of allowed CORS origins'),
  
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  
  ALLOW_NO_AUTH: Joi.boolean()
    .default(false)
    .description('Allow requests without authentication (development only)'),
  
  FIREBASE_PROJECT_ID: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .description('Firebase project ID for authentication'),
  
  FIREBASE_PRIVATE_KEY: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .description('Firebase private key for admin SDK'),
  
  FIREBASE_CLIENT_EMAIL: Joi.string()
    .email()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .description('Firebase client email for admin SDK'),
}).unknown();

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

// Export configuration object
export const config = {
  env: envVars.NODE_ENV,
  
  server: {
    port: envVars.PORT,
  },
  
  database: {
    uri: envVars.MONGODB_URI,
  },
  
  cors: {
    origins: envVars.CORS_ORIGINS.split(',').map((origin: string) => origin.trim()),
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
  },
  
  auth: {
    allowNoAuth: envVars.ALLOW_NO_AUTH,
    firebase: {
      projectId: envVars.FIREBASE_PROJECT_ID,
      privateKey: envVars.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
    },
  },
  
  // Feature flags
  features: {
    enableSTT: true,
    enableTTS: true,
    enableEmbeddings: true,
    enablePushNotifications: true,
  },
  
  // Rate limiting configuration
  rateLimits: {
    query: {
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 requests per minute per enterprise
    },
    upload: {
      windowMs: 60 * 1000, // 1 minute
      max: 5, // 5 uploads per minute
    },
    general: {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute per IP
    },
  },
  
  // File upload limits
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
  },
  
  // AI model configuration
  models: {
    embedding: {
      name: 'all-MiniLM-L6-v2',
      dimensions: 384,
    },
    stt: {
      model: 'vosk-model-small-en-us-0.15',
    },
    tts: {
      model: 'en_US-lessac-medium',
    },
  },
};