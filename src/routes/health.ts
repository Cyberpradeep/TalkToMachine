import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    api: ServiceHealth;
    database: ServiceHealth;
    embeddings: ServiceHealth;
    vectorStore: ServiceHealth;
    firebase: ServiceHealth;
    stt: ServiceHealth;
    tts: ServiceHealth;
  };
  uptime: number;
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'not_configured';
  message?: string;
  responseTime?: number;
}

// Health check endpoint
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.env,
      services: {
        api: await checkApiHealth(),
        database: await checkDatabaseHealth(),
        embeddings: await checkEmbeddingsHealth(),
        vectorStore: await checkVectorStoreHealth(),
        firebase: await checkFirebaseHealth(),
        stt: await checkSTTHealth(),
        tts: await checkTTSHealth(),
      },
      uptime: process.uptime(),
    };

    // Determine overall health status
    const serviceStatuses = Object.values(healthStatus.services);
    const unhealthyServices = serviceStatuses.filter(service => service.status === 'unhealthy');
    const notConfiguredServices = serviceStatuses.filter(service => service.status === 'not_configured');

    if (unhealthyServices.length > 0) {
      healthStatus.status = 'unhealthy';
    } else if (notConfiguredServices.length > 0) {
      healthStatus.status = 'degraded';
    }

    // Set appropriate HTTP status code
    const httpStatus = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    const responseTime = Date.now() - startTime;
    logger.info('Health check completed', {
      status: healthStatus.status,
      responseTime,
      services: Object.fromEntries(
        Object.entries(healthStatus.services).map(([key, value]) => [key, value.status])
      ),
    });

    res.status(httpStatus).json(healthStatus);

  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      uptime: process.uptime(),
    });
  }
});

// Individual service health checks
async function checkApiHealth(): Promise<ServiceHealth> {
  return {
    status: 'healthy',
    message: 'API server is running',
    responseTime: 0,
  };
}

async function checkDatabaseHealth(): Promise<ServiceHealth> {
  try {
    const startTime = Date.now();
    
    if (mongoose.connection.readyState !== 1) {
      return {
        status: 'unhealthy',
        message: 'Database connection not established',
      };
    }

    // Perform a simple database operation
    await mongoose.connection.db.admin().ping();
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      message: 'Database connection is healthy',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function checkEmbeddingsHealth(): Promise<ServiceHealth> {
  // For now, just check if the feature is enabled
  if (!config.features.enableEmbeddings) {
    return {
      status: 'not_configured',
      message: 'Embeddings service is disabled',
    };
  }

  // TODO: Add actual embeddings service health check when implemented
  return {
    status: 'not_configured',
    message: 'Embeddings service not yet implemented',
  };
}

async function checkVectorStoreHealth(): Promise<ServiceHealth> {
  // Vector store is currently in-memory, so just check if it's enabled
  return {
    status: 'not_configured',
    message: 'Vector store not yet implemented',
  };
}

async function checkFirebaseHealth(): Promise<ServiceHealth> {
  if (config.auth.allowNoAuth) {
    return {
      status: 'not_configured',
      message: 'Firebase auth is bypassed in development mode',
    };
  }

  if (!config.auth.firebase.projectId) {
    return {
      status: 'not_configured',
      message: 'Firebase configuration not provided',
    };
  }

  // TODO: Add actual Firebase health check when implemented
  return {
    status: 'not_configured',
    message: 'Firebase service not yet implemented',
  };
}

async function checkSTTHealth(): Promise<ServiceHealth> {
  if (!config.features.enableSTT) {
    return {
      status: 'not_configured',
      message: 'STT service is disabled',
    };
  }

  // TODO: Add actual STT service health check when implemented
  return {
    status: 'not_configured',
    message: 'STT service not yet implemented',
  };
}

async function checkTTSHealth(): Promise<ServiceHealth> {
  if (!config.features.enableTTS) {
    return {
      status: 'not_configured',
      message: 'TTS service is disabled',
    };
  }

  // TODO: Add actual TTS service health check when implemented
  return {
    status: 'not_configured',
    message: 'TTS service not yet implemented',
  };
}

export { router as healthRouter };