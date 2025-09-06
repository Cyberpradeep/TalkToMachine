import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/environment';
import { connectDatabase } from './config/database';
import { initializeFirebase } from './config/firebase';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { applySecurity } from './middleware/security';
import { generalRateLimit, healthRateLimit } from './middleware/rateLimiting';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';

const app = express();

// Apply security middleware stack
app.use(applySecurity());

// CORS configuration
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Debug-Role'],
}));

// Request parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Apply general rate limiting to all routes
app.use(generalRateLimit);

// Routes with specific rate limiting
app.use('/health', healthRateLimit, healthRouter);
app.use('/auth', authRouter);

// Global error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    
    // Initialize Firebase (will skip in dev mode if ALLOW_NO_AUTH is true)
    try {
      initializeFirebase();
    } catch (error) {
      if (config.env === 'production') {
        throw error; // Firebase is required in production
      }
      logger.warn('Firebase initialization failed, continuing in development mode:', error);
    }
    
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`TalkToMachine server started on port ${port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Health check available at: http://localhost:${port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

export { app };