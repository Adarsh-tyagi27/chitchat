import { getRequestId } from '../middleware/requestId.js';

export const logger = {
  info: (message, data = {}) => {
    const requestId = getRequestId();
    const timestamp = new Date().toISOString();
    const extra = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    console.log(`${timestamp} [INFO] [RequestID: ${requestId}] ${message}${extra}`);
  },

  warn: (message, data = {}) => {
    const requestId = getRequestId();
    const timestamp = new Date().toISOString();
    const extra = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    console.warn(`${timestamp} [WARN] [RequestID: ${requestId}] ${message}${extra}`);
  },

  error: (message, error = {}) => {
    const requestId = getRequestId();
    const timestamp = new Date().toISOString();
    const errorInfo =
      error instanceof Error ? { message: error.message, stack: error.stack } : error;
    const extra = Object.keys(errorInfo).length > 0 ? ` ${JSON.stringify(errorInfo)}` : '';
    console.error(`${timestamp} [ERROR] [RequestID: ${requestId}] ${message}${extra}`);
  },

  debug: (message, data = {}) => {
    const requestId = getRequestId();
    const timestamp = new Date().toISOString();
    const extra = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    console.debug(`${timestamp} [DEBUG] [RequestID: ${requestId}] ${message}${extra}`);
  },
};
