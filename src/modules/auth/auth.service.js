import { hash, compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/loggers.js';
import { ApiError } from '../../utils/ApiErrors.js';

export class AuthService {
  static async register(email, password, fullName) {
    logger.info('Registering user', { email });

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ApiError(409, 'Email already registered');
    }

    const hashedPassword = await hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
      },
    });

    logger.info('User registered', { userId: user.id });

    return this.formatUser(user);
  }

  static async login(email, password) {
    logger.info('Login attempt', { email });

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const isPasswordValid = await compare(password, user.password);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, email);

    logger.info('User logged in', { userId: user.id });

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  static async generateTokens(userId, email) {
    const accessToken = jwt.sign(
      { userId, email },
      env.jwt.accessSecret,
      { expiresIn: env.jwt.accessExpiry }
    );

    const refreshTokenString = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshTokenString,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
      expiresIn: env.jwt.accessExpiry,
      refreshExpiresIn: env.jwt.refreshExpiry,
    };
  }

  static async refreshAccessToken(refreshToken, userId) {
    logger.info('Refreshing access token', { userId });

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.isRevoked) {
      await this.handleTokenReuse(userId);
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new ApiError(401, 'Refresh token expired');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'rotated',
        },
      });

      const accessToken = jwt.sign(
        { userId, email: user.email },
        env.jwt.accessSecret,
        { expiresIn: env.jwt.accessExpiry }
      );

      const newRefreshTokenString = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await tx.refreshToken.create({
        data: {
          userId,
          token: newRefreshTokenString,
          expiresAt,
        },
      });

      return {
        accessToken,
        refreshToken: newRefreshTokenString,
        expiresIn: env.jwt.accessExpiry,
      };
    });

    return result;
  }

  static async handleTokenReuse(userId) {
    logger.error('🚨 TOKEN REUSE DETECTED!', { userId });

    try {
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'reuse_detected',
        },
      });

      logger.error('All tokens revoked for user', { userId });
    } catch (error) {
      logger.error('Failed to revoke tokens', error);
    }
  }

  static async logout(refreshToken, userId) {
    logger.info('User logging out', { userId });

    await prisma.refreshToken.updateMany({
      where: { token: refreshToken, userId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'manual_logout',
      },
    });

    logger.info('User logged out', { userId });
  }

  static formatUser(user) {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, env.jwt.accessSecret);
    } catch (error) {
      throw new ApiError(401, 'Invalid token');
    }
  }
}