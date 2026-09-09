import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import prisma from './config/database.js';
import { WebSocketServer } from './modules/chat/ws.server.js';

const PORT = env.PORT;

let server;
let wsServer;
let activeRequests = 0;

// ========== ACTIVE REQUEST TRACKING ==========
app.use((req, res, next) => {
  activeRequests++;

  logger.info('Request started', {
    method: req.method,
    path: req.path,
    activeRequests,
  });

  res.on('finish', () => {
    activeRequests--;

    logger.info('Request finished', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      activeRequests,
    });
  });

  next();
});

// ========== START SERVER ==========
async function startServer() {
  try {
    logger.info('Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✓ Database connected');

    // Create HTTP server
    server = http.createServer(app);

    // Create WebSocket server
    wsServer = new WebSocketServer(server);

    // Start listening
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`✓ Server running on http://localhost:${PORT}`);
      logger.info(`✓ WebSocket running on ws://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// ========== GRACEFUL SHUTDOWN ==========
async function gracefulShutdown(signal) {
  logger.warn(`Received ${signal} signal, starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close WebSocket server
      await wsServer.shutdown();

      // Wait for active requests
      let waitTime = 0;
      const maxWaitTime = 30000;

      while (activeRequests > 0 && waitTime < maxWaitTime) {
        logger.info(`Waiting for ${activeRequests} active request(s)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
      }

      logger.info('All requests completed');

      // Close database
      logger.info('Disconnecting from database...');
      await prisma.$disconnect();
      logger.info('✓ Database disconnected');

      logger.info('✓ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  });

  // Force shutdown after 35 seconds
  setTimeout(() => {
    logger.error('Forced shutdown: timeout');
    process.exit(1);
  }, 35000);
}

// ========== SIGNAL HANDLERS ==========
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
  process.exit(1);
});

// ========== START ==========
startServer();