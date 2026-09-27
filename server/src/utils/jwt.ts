import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type TokenRole = 'PUBLIC' | 'STUDENT' | 'TEACHER' | 'ADMIN';
export interface AuthTokenPayload { sub: string; role: TokenRole; }

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d', issuer: 'harshit-education-center' });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET, { issuer: 'harshit-education-center' }) as AuthTokenPayload;
}
