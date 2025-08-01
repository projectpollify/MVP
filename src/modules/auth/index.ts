// src/index.ts

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import groupRoutes from './modules/groups/groups.routes';
import blockchainRoutes from './modules/blockchain/blockchain.routes';

// Import event system
import { eventEmitter } from './shared/events';

// Load environment variables
dotenv.config();

// Initialize Prisma
const prisma = new PrismaClient();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    modules: {
      auth: 'active',
      groups: 'active',
      blockchain: 'active'
    }
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/blockchain', blockchainRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Pollify MVP API',
    version: '1.0.0',
    modules: [
      'Authentication (Module 2)',
      'Groups & Content (Module 3)',
      'Blockchain & Tokens (Module 4)'
    ],
    endpoints: {
      auth: '/api/v1/auth',
      groups: '/api/v1/groups',
      blockchain: '/api/v1/blockchain'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Event listeners for cross-module communication
eventEmitter.on('auth:user_authenticated', (data) => {
  console.log('User authenticated:', data.walletAddress);
});

eventEmitter.on('posts:created', (data) => {
  console.log('Post created:', data.postId);
});

eventEmitter.on('token:transferred', (data) => {
  console.log('Token transferred:', {
    token: data.token,
    from: data.from.slice(0, 10) + '...',
    to: data.to.slice(0, 10) + '...',
    amount: data.amount
  });
});

eventEmitter.on('record:created', (data) => {
  console.log('Blockchain record created:', {
    type: data.type,
    txHash: data.txHash
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`
🚀 Pollify MVP Server Running
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🔗 Blockchain: ${process.env.CARDANO_NETWORK || 'preprod'}

Available Endpoints:
- GET  /health
- GET  /api/v1/auth/nonce/:address
- POST /api/v1/auth/verify
- GET  /api/v1/auth/me
- GET  /api/v1/groups
- POST /api/v1/groups/:groupId/posts
- GET  /api/v1/blockchain/tokens
- GET  /api/v1/blockchain/balance/:address
- POST /api/v1/blockchain/faucet/claim
... and more

Ready to receive requests!
  `);
});

export default server;
