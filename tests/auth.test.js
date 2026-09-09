/**
 * Auth route integration tests
 *
 * Uses jest.unstable_mockModule to intercept the Prisma client before any
 * auth modules are loaded (required for ESM module mocking).
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ========== Set up Prisma mock BEFORE importing app ==========
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

await jest.unstable_mockModule('../src/config/database.js', () => ({
  default: mockPrisma,
}));

// Import app AFTER mocks are registered
const { default: app } = await import('../src/app.js');

// ========== POST /api/v1/auth/register ==========
describe('POST /api/v1/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register a new user and return 201', async () => {
    const { default: request } = await import('supertest');

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      password: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'password123', fullName: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message', 'User registered successfully');
    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).toHaveProperty('email', 'test@example.com');
  });

  it('should return 409 if email already registered', async () => {
    const { default: request } = await import('supertest');

    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: 'test@example.com' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'password123', fullName: 'Test User' });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.message).toMatch(/already registered/i);
  });
});

// ========== POST /api/v1/auth/login ==========
describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 for unknown email', async () => {
    const { default: request } = await import('supertest');

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'wrong@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('should return tokens on valid credentials', async () => {
    const { default: request } = await import('supertest');
    const { hash } = await import('bcrypt');
    const hashedPassword = await hash('password123', 10);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      password: hashedPassword,
      fullName: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('tokens');
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');
    expect(res.body.data.user).not.toHaveProperty('password');
  });
});

// ========== POST /api/v1/auth/logout ==========
describe('POST /api/v1/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 and confirm logout', async () => {
    const { default: request } = await import('supertest');

    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'some-token', userId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });
});
