import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sage-dev-secret-change-in-production';

interface JwtPayload {
  userId: number;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        role: string;
        must_change_password?: number;
        created_at: string;
      };
    }
  }
}

export const COOKIE_OPTIONS: import('express').CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  secure: process.env.NODE_ENV === 'production',
};

export function signToken(userId: number, role: string): string {
  return jwt.sign({ userId, role } as JwtPayload, JWT_SECRET, { expiresIn: '7d' });
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const user = db.prepare(
      'SELECT id, username, email, role, must_change_password, created_at FROM users WHERE id = ?'
    ).get(payload.userId) as Request['user'] | undefined;

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;

    // Sliding window: refresh cookie on each authenticated request
    res.cookie('token', signToken(user.id, user.role), COOKIE_OPTIONS);

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
