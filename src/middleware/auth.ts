import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError, ah } from '../utils/http';
import { User } from '../models/User';

export interface AuthPayload {
  sub: string;
  role: 'customer' | 'admin';
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      user?: any; // hydrated User document (customers only)
    }
  }
}

export function signToken(p: AuthPayload, expiresIn: string) {
  if (env.jwtSecret.length < 32) throw new HttpError(500, 'Server is not configured: JWT_SECRET must be 32+ characters');
  return jwt.sign(p, env.jwtSecret, { expiresIn } as jwt.SignOptions);
}

function readToken(req: Request): AuthPayload {
  const h = req.headers.authorization ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw new HttpError(401, 'Please log in to continue');
  try {
    return jwt.verify(token, env.jwtSecret) as AuthPayload;
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again');
  }
}

export const requireCustomer = ah(async (req: Request, _res: Response, next: NextFunction) => {
  const p = readToken(req);
  if (p.role !== 'customer') throw new HttpError(403, 'Customer account required');
  const user = await User.findById(p.sub);
  if (!user) throw new HttpError(401, 'Account not found. Please log in again');
  req.auth = p;
  req.user = user;
  next();
});

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const p = readToken(req);
    if (p.role !== 'admin' || !env.adminEmail || p.email !== env.adminEmail) {
      throw new HttpError(403, 'Admin access only');
    }
    req.auth = p;
    next();
  } catch (e) {
    next(e);
  }
};
