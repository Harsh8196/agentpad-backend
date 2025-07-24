import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { authMiddleware } from './middleware/auth.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import flowRoutes from './routes/flows.js';
import agentRoutes from './routes/agents.js';
import templateRoutes from './routes/templates.js';
import executionRoutes from './routes/executions.js';
import analyticsRoutes from './routes/analytics.js';

// Import database connection
import { initializeDatabase } from './database/connection.js';
import { connectRedis } from './database/redis.js';

// Load environment variables
dotenv.config({ path: './env.dev' });

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'development' ? true : (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ["http://localhost:3001", "http://localhost:3002"]),
  credentials: true
}));
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/flows', authMiddleware, flowRoutes);
app.use('/api/agents', authMiddleware, agentRoutes);
app.use('/api/templates', authMiddleware, templateRoutes);
app.use('/api/executions', authMiddleware, executionRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Join user to their personal room
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    logger.info(`User ${userId} joined their room`);
  });

  // Join flow execution room
  socket.on('join-flow', (flowId) => {
    socket.join(`flow-${flowId}`);
    logger.info(`Client joined flow ${flowId}`);
  });

  // Handle flow execution updates
  socket.on('flow-execution-update', (data) => {
    socket.to(`flow-${data.flowId}`).emit('flow-execution-update', data);
  });

  // Handle agent status updates
  socket.on('agent-status-update', (data) => {
    socket.to(`user-${data.userId}`).emit('agent-status-update', data);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Database and server startup
const startServer = async () => {
  try {
    // Initialize SQLite database
    initializeDatabase();
    
    // Try to connect to Redis (optional)
    try {
      await connectRedis();
    } catch (error) {
      logger.warn('Redis connection failed, continuing without Redis');
    }
    
    const PORT = process.env.PORT || 3000;
    
    server.listen(PORT, () => {
      logger.info(`🚀 AgentPad Backend Server running on port ${PORT}`);
      logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
      logger.info(`💾 Database: SQLite (${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'} mode)`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

startServer();

export { io };