import webSocket from 'ws';
import { logger } from '../../utils/loggers.js';
import { wsManager } from './ws.manager.js';
import { AuthService } from '../auth/auth.service.js';

export class WebSocketServer {
  constructor(httpServer) {
    this.wss = new webSocket.Server({ server: httpServer });

    logger.info('WebSocket server started');

    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  // ========== HANDLE NEW CONNECTION ==========

  async handleConnection(ws) {
    logger.info('New WebSocket connection established');

    // First message must be an 'init' with a JWT token and roomId
    ws.once('message', (data) => {
      try {
        const message = JSON.parse(data);
        const { type, token, roomId } = message;

        if (type !== 'init') {
          ws.send(
            JSON.stringify({
              type: 'error',
              error: 'First message must be init',
            })
          );
          ws.close();
          return;
        }

        // Verify JWT token
        let decoded;
        try {
          decoded = AuthService.verifyAccessToken(token);
        } catch (err) {
          logger.error(`Token verification failed: ${err.message}`);
          ws.send(
            JSON.stringify({
              type: 'error',
              error: 'Invalid token',
            })
          );
          ws.close();
          return;
        }

        const userId = decoded.userId;

        logger.info(`User ${userId} authenticated via WebSocket`);

        // Add user to room
        wsManager.handleUserConnect(ws, userId, roomId);

        // Handle subsequent messages from this user
        ws.on('message', (data) => {
          try {
            wsManager.handleIncomingMessage(ws, data);
          } catch (error) {
            logger.error('Error handling message', error);
            ws.send(
              JSON.stringify({
                type: 'error',
                error: 'Invalid message format',
              })
            );
          }
        });

        // Handle disconnect
        ws.on('close', () => {
          wsManager.handleUserDisconnect(ws);
        });

        // Handle errors
        ws.on('error', (error) => {
          logger.error('WebSocket error', error);
        });
      } catch (error) {
        logger.error('Error in WebSocket connection handler', error);
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'Connection error',
          })
        );
        ws.close();
      }
    });
  }

  // ========== GRACEFUL SHUTDOWN ==========

  async shutdown() {
    logger.info('Closing WebSocket server...');

    return new Promise((resolve) => {
      this.wss.clients.forEach((ws) => {
        ws.close();
      });

      this.wss.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      });
    });
  }
}