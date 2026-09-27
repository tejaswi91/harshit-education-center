import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['STUDENT', 'TEACHER']).default('STUDENT'),
  className: z.string().trim().min(1).max(60).optional(),
  board: z.string().trim().min(1).optional(),
  schoolName: z.string().trim().max(160).optional(),
  guardianName: z.string().trim().max(120).optional(),
  mobile: z.string().trim().max(20).optional(),
  qualification: z.string().trim().max(180).optional(),
  bio: z.string().trim().max(1000).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128)
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  className: z.string().trim().min(1).max(60).optional(),
  board: z.string().trim().nullable().optional(),
  schoolName: z.string().trim().max(160).optional(),
  guardianName: z.string().trim().max(120).optional(),
  mobile: z.string().trim().max(20).optional(),
  qualification: z.string().trim().max(180).optional(),
  bio: z.string().trim().max(1000).optional(),
  photoUrl: z.string().trim().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128)
});
