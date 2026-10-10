import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http';
import { env } from '../config/env';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, 'Route not found'));
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err?.name === 'ValidationError') {
    const first = Object.values(err.errors ?? {})[0] as any;
    return res.status(400).json({ message: first?.message ?? 'Invalid data' });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'value';
    return res.status(409).json({ message: `That ${field} already exists` });
  }
  if (err?.name === 'CastError') return res.status(400).json({ message: 'Invalid value provided' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' });
  console.error('[error]', err);
  res.status(500).json({ message: env.isProd ? 'Something went wrong on our side' : String(err?.message ?? err) });
}
