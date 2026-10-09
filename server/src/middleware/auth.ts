import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { User } from '../models/User.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { HttpError } from '../utils/httpError.js';
import { verifyToken, type TokenRole } from '../utils/jwt.js';

function readToken(header?: string) {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

async function resolveUser(req: Request) {
  const token = readToken(req.headers.authorization);
  if (!token) return null;
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Invalid or expired session');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'Account not found');
  if (!user.isActive) throw new HttpError(401, 'Account is disabled');
  if (user.role === 'TEACHER') {
    const profile = await TeacherProfile.findOne({ user: user._id }).select('approved');
    if (!profile?.approved) throw new HttpError(403, 'Teacher account is awaiting administrator approval');
  }
  return { id: user._id.toString(), role: user.role as TokenRole, email: user.email, name: user.name };
}

export const requireAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const user = await resolveUser(req);
    if (!user) throw new HttpError(401, 'Authentication required');
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/** Populates req.user when a valid token is present; public routes remain public without one. */
export const optionalAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    req.user = await resolveUser(req) ?? undefined;
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...roles: TokenRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission for this action'));
    next();
  };
}
