import { logger } from '../utils/loggers.js';
import { ApiError } from '../utils/ApiErrors.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred:', err);

  const requestId = req.requestId || 'no-request-id';
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message = err instanceof ApiError ? err.message : 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    requestId,
  });
};