// ==============================================================================
// AGENT-CORE SERVER & AUTONOMOUS WORKER ENTRYPOINT
// ==============================================================================

import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './api/routes.js';
import { errorHandler, requestLogger } from './api/middleware.js';
import { autonomousWorker } from './engine/worker.js';

const app = express();

// Global Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(requestLogger);

// API Routes
app.use(apiRouter);

// Error Handling Middleware
app.use(errorHandler);

// Inicialização do Servidor HTTP e Background Worker
const server = app.listen(env.PORT, () => {
  console.log(`================================================================`);
  console.log(`⚡ EI-AIOS Agent Core Server running on port ${env.PORT}`);
  console.log(`🌐 Environment: ${env.NODE_ENV} | Domain: ${env.DOMAIN}`);
  console.log(`🤖 Fast Model: ${env.GEMINI_DEFAULT_FAST_MODEL} | Reasoning: ${env.GEMINI_DEFAULT_REASONING_MODEL}`);
  console.log(`================================================================`);

  // Inicia o loop contínuo do Worker Autônomo
  autonomousWorker.start();
});

// Tratamento de Encerramento Gracioso (Graceful Shutdown)
function handleShutdown(signal: string) {
  console.log(`\n[Shutdown] Received ${signal}. Stopping Worker and terminating server...`);
  autonomousWorker.stop();
  server.close(() => {
    console.log('[Shutdown] Server closed gracefully.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[Shutdown] Force exit after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default app;

