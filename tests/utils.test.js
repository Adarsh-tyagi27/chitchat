import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ApiError } from '../src/utils/ApiErrors.js';
import { ApiResponse } from '../src/utils/ApiResponse.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';

// ========== ApiError ==========
describe('ApiError', () => {
  it('should create an error with a statusCode and message', () => {
    const err = new ApiError(404, 'Not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('ApiError');
  });

  it('should default to inheriting from Error', () => {
    const err = new ApiError(500, 'Server error');
    expect(err.stack).toBeDefined();
  });

  it('should handle 4xx status codes', () => {
    const err401 = new ApiError(401, 'Unauthorized');
    const err409 = new ApiError(409, 'Conflict');
    expect(err401.statusCode).toBe(401);
    expect(err409.statusCode).toBe(409);
  });
});

// ========== ApiResponse ==========
describe('ApiResponse', () => {
  it('should create a response with statusCode, message, and data', () => {
    const resp = new ApiResponse(200, 'OK', { id: 1 });
    expect(resp.statusCode).toBe(200);
    expect(resp.message).toBe('OK');
    expect(resp.data).toEqual({ id: 1 });
  });

  it('should default data to null when not provided', () => {
    const resp = new ApiResponse(201, 'Created');
    expect(resp.data).toBeNull();
  });
});

// ========== asyncHandler ==========
describe('asyncHandler', () => {
  it('should call next with error when async handler rejects', async () => {
    const error = new Error('Something failed');
    const fakeHandler = asyncHandler(async () => {
      throw error;
    });

    const next = jest.fn();
    await fakeHandler({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('should call the handler function on success', async () => {
    const mockFn = jest.fn().mockResolvedValue(undefined);
    const fakeHandler = asyncHandler(mockFn);

    const req = {};
    const res = {};
    const next = jest.fn();
    await fakeHandler(req, res, next);

    expect(mockFn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});
