import express from 'express';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/requestId.js';
import authRoutes from './modules/auth/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ========== MIDDLEWARE ==========
app.use(requestIdMiddleware);
app.use(express.json());
app.use(cors());

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ========== ROUTES ==========
app.use('/api/v1/auth', authRoutes);

// ========== 404 ==========
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// ========== ERROR HANDLER ==========
app.use(errorHandler);

export default app;