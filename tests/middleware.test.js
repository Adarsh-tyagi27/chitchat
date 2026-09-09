import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ApiError } from '../src/utils/ApiErrors.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

// ========== errorHandler ==========
describe('errorHandler middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { requestId: 'test-request-id' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it('should return the correct status code and message for ApiError', () => {
    const err = new ApiError(400, 'Bad Request');
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Bad Request',
        requestId: 'test-request-id',
      })
    );
  });

  it('should return 500 for non-ApiError errors', () => {
    const err = new Error('Unexpected crash');
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Internal Server Error',
      })
    );
  });

  it('should use "no-request-id" when req.requestId is missing', () => {
    const err = new ApiError(404, 'Not Found');
    errorHandler(err, {}, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'no-request-id',
      })
    );
  });
});

// ========== requestId middleware ==========
describe('requestIdMiddleware', () => {
  it('should attach a requestId to req and set the x-request-id header', async () => {
    // Dynamic import to avoid module-level side effects
    const { requestIdMiddleware } = await import('../src/middleware/requestId.js');

    const req = {};
    const res = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.requestId);
  });
});
