// Manual mock for src/config/database.js
// Jest picks this up automatically when jest.mock('../src/config/database.js') is called

import { jest } from '@jest/globals';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

export default mockPrisma;
export { mockPrisma };
