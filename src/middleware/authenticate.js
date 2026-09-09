import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiErrors.js';
import { logger } from '../utils/loggers.js';

export const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    logger.error('No token provided');
    return next(new ApiError(401, 'No token provided'));
  }

  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret);
    req.user = decoded;
    logger.info('Token verified successfully', { userId: decoded.userId });
    next();
  } catch (err) {
    return next(new ApiError(401, 'Invalid token'));
  }
};