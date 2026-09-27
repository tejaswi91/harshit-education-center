import { z } from 'zod';
import { MATERIAL_STATUSES, MATERIAL_TYPES, ACCESS_TYPES } from '../models/Material.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const materialQuerySchema = z.object({
  className: z.string().trim().optional(),
  subject: objectId.optional(),
  board: objectId.optional(),
  chapter: z.string().trim().optional(),
  materialType: z.enum(MATERIAL_TYPES).optional(),
  accessType: z.enum(ACCESS_TYPES).optional(),
  status: z.enum(MATERIAL_STATUSES).optional(),
  featured: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(['recent', 'oldest', 'title', 'downloads', 'price-low', 'price-high']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12)
});

export const materialBodySchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().min(2).max(2000),
  className: z.string().trim().min(1).max(60),
  subject: objectId,
  board: objectId.nullable().optional(),
  chapter: z.string().trim().max(180).optional(),
  materialType: z.enum(MATERIAL_TYPES),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
  accessType: z.enum(ACCESS_TYPES),
  price: z.coerce.number().min(0).default(0),
  status: z.enum(MATERIAL_STATUSES).default('DRAFT'),
  featured: z.coerce.boolean().default(false)
});

export const materialUpdateSchema = materialBodySchema.partial();

export const idParamSchema = z.object({ id: objectId });

export const settingsSchema = z.object({
  instituteName: z.string().trim().min(1).max(160).optional(),
  tagline: z.string().trim().max(240).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().or(z.literal('')).optional(),
  address: z.string().trim().max(400).optional(),
  socialLinks: z.object({
    youtube: z.string().trim().optional(),
    instagram: z.string().trim().optional(),
    facebook: z.string().trim().optional(),
    linkedin: z.string().trim().optional()
  }).optional(),
  logoUrl: z.string().trim().optional(),
  heroImageUrl: z.string().trim().optional(),
  admissionMessage: z.string().trim().max(600).optional()
});

export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z.string().trim().min(6).max(20),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  className: z.string().trim().min(1).max(60),
  board: objectId.optional().or(z.literal('')),
  message: z.string().trim().min(5).max(2000)
});

export const courseSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and dashes'),
  className: z.string().trim().min(1).max(60),
  description: z.string().trim().min(2).max(1200),
  subjects: z.array(objectId).default([]),
  boards: z.array(objectId).default([]),
  active: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0)
});

export const subjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9-]+$/),
  classes: z.array(z.string().trim().min(1)).default([]),
  active: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0)
});

export const boardSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(500).optional(),
  active: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0)
});

export const noticeSchema = z.object({
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(2).max(4000),
  category: z.enum(['ADMISSION', 'EXAM', 'MATERIAL', 'GENERAL']).default('GENERAL'),
  published: z.coerce.boolean().default(true),
  publishDate: z.coerce.date().default(() => new Date())
});

export const gallerySchema = z.object({
  title: z.string().trim().min(2).max(160),
  imageUrl: z.string().trim().min(1),
  altText: z.string().trim().min(2).max(160),
  category: z.string().trim().max(80).optional(),
  published: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0)
});

export const testimonialSchema = z.object({
  name: z.string().trim().min(2).max(100),
  quote: z.string().trim().min(5).max(800),
  className: z.string().trim().min(1).max(60),
  photoUrl: z.string().trim().optional(),
  published: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0)
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
  isActive: z.coerce.boolean().optional(),
  password: z.string().min(8).max(128).optional()
});

export const teacherReviewSchema = z.object({
  approved: z.coerce.boolean(),
  canManageAllMaterials: z.coerce.boolean().optional()
});
