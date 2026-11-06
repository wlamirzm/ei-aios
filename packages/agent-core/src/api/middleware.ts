// ==============================================================================
// API MIDDLEWARE: ERROR HANDLING & LOGGING
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  const start = Date.now();
  const method = req.method;
  const path = req.path;

  _res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${method} ${path} -> ${_res.statusCode} (${duration}ms)`);
  });

  next();
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[API ErrorHandler] Exception caught:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      details: err.errors
    });
    return;
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    statusCode
  });
}

