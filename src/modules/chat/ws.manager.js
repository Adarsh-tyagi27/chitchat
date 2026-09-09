import { logger } from '../../utils/loggers.js';
import prisma from '../../config/database.js';

export class WebSocketManager {
  constructor() {
    // map of userId → Set of websocket connections (multi-tab support)
    this.userConnections = new Map();

    // map of roomId → Set of userId in room
    this.roomUsers = new Map();

    // map of userId → typing indicator
    this.typingUsers = new Map();
  }

  // ========== USER CONNECT ==========

  handleUserConnect(ws, userId, roomId) {
    logger.info(`User ${userId} connected to room ${roomId}`);

    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId).add(ws);

    if (!this.roomUsers.has(roomId)) {
      this.roomUsers.set(roomId, new Set());
    }
    this.roomUsers.get(roomId).add(userId);

    // Store metadata on the ws object for quick lookup later
    ws.userId = userId;
    ws.roomId = roomId;

    logger.info(
      `User ${userId} joined room ${roomId}. Connections: ${this.userConnections.get(userId).size}`
    );

    // Send current room users to the newly connected user
    ws.send(
      JSON.stringify({
        type: 'usersInRoom',
        users: Array.from(this.roomUsers.get(roomId)),
      })
    );
  }

  // ========== USER DISCONNECT ==========

  handleUserDisconnect(ws) {
    const userId = ws.userId;
    const roomId = ws.roomId;

    if (!userId || !roomId) return;

    logger.info(`User ${userId} disconnected from room ${roomId}`);

    if (this.userConnections.has(userId)) {
      this.userConnections.get(userId).delete(ws);

      if (this.userConnections.get(userId).size === 0) {
        this.userConnections.delete(userId);
      }
    }

    if (this.roomUsers.has(roomId)) {
      this.roomUsers.get(roomId).delete(userId);

      logger.info(
        `User ${userId} removed from room ${roomId}. Users remaining: ${this.roomUsers.get(roomId).size}`
      );

      this.broadcastToRoom(roomId, {
        type: 'userDisconnected',
        userId,
        usersInRoom: Array.from(this.roomUsers.get(roomId)),
      });
    }

    // Clear typing indicator if user was typing
    if (this.typingUsers.has(userId)) {
      this.typingUsers.delete(userId);
    }
  }

  // ========== HANDLE INCOMING MESSAGE ==========

  async handleIncomingMessage(ws, data) {
    const userId = ws.userId;
    const roomId = ws.roomId;

    try {
      const { type, content } = JSON.parse(data);

      if (type === 'message') {
        logger.info(`Message from user ${userId} in room ${roomId}: ${content}`);

        const message = await prisma.message.create({
          data: {
            userId,
            roomId,
            content,
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        });

        this.broadcastToRoom(roomId, {
          type: 'new-message',
          message: {
            id: message.id,
            content: message.content,
            userId: message.userId,
            userName: message.user.fullName,
            createdAt: message.createdAt,
          },
        });
      } else if (type === 'typing') {
        this.typingUsers.set(userId, true);

        this.broadcastToRoom(roomId, {
          type: 'userTyping',
          userId,
        });

        setTimeout(() => {
          if (this.typingUsers.has(userId)) {
            this.typingUsers.delete(userId);
            this.broadcastToRoom(roomId, {
              type: 'userStoppedTyping',
              userId,
            });
          }
        }, 3000);
      }
    } catch (error) {
      logger.error(
        `Error handling message from user ${userId} in room ${roomId}: ${error.message}`
      );
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'An error occurred while processing your message.',
        })
      );
    }
  }

  // ========== BROADCAST TO ROOM ==========

  broadcastToRoom(roomId, data) {
    const usersInRoom = this.roomUsers.get(roomId);

    if (!usersInRoom || usersInRoom.size === 0) {
      logger.warn(`No users found in room ${roomId}`);
      return;
    }

    usersInRoom.forEach((userId) => {
      const connections = this.userConnections.get(userId);
      if (connections) {
        connections.forEach((ws) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(data));
          }
        });
      }
    });

    logger.info(`Broadcasted to room ${roomId}`);
  }

  // ========== HELPERS ==========

  getUsersInRoom(roomId) {
    if (this.roomUsers.has(roomId)) {
      return Array.from(this.roomUsers.get(roomId));
    }
    return [];
  }

  isUserInRoom(userId, roomId) {
    if (this.roomUsers.has(roomId)) {
      return this.roomUsers.get(roomId).has(userId);
    }
    return false;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();