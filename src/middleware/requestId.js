import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

export const requestIdMiddleware = (req, res, next) => {
  const requestId = uuidv4();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  asyncLocalStorage.run(requestId, () => {
    next();
  });
};

export const getRequestId = () => {
  return asyncLocalStorage.getStore() || 'no-request-id';
};