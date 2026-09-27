import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { Material } from '../models/Material.js';
import { Course } from '../models/Course.js';
import { Subject } from '../models/Subject.js';
import { Board } from '../models/Board.js';
import { Notice } from '../models/Notice.js';
import { GalleryItem } from '../models/GalleryItem.js';
import { Testimonial } from '../models/Testimonial.js';
import { Enquiry } from '../models/Enquiry.js';
import { Settings } from '../models/Settings.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { materialQuerySchema, enquirySchema } from '../validators/index.js';
import { CLASS_LEVELS, publishedFilter, resolveMaterialAccess, toPublicMaterial } from '../services/access.js';

export const publicRoutes = Router();

const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
  recent: { uploadedDate: -1 },
  oldest: { uploadedDate: 1 },
  title: { title: 1 },
  downloads: { downloadCount: -1 },
  'price-low': { price: 1, uploadedDate: -1 },
  'price-high': { price: -1, uploadedDate: -1 }
};

publicRoutes.get('/settings', asyncHandler(async (_req, res) => {
  const settings = await Settings.findOne().lean();
  res.json(settings ?? {});
}));

publicRoutes.get('/classes', (_req, res) => {
  res.json(CLASS_LEVELS.map((item) => ({ ...item })));
});

publicRoutes.get('/boards', asyncHandler(async (_req, res) => {
  res.json(await Board.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean());
}));

publicRoutes.get('/subjects', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { active: true };
  if (typeof req.query.className === 'string' && req.query.className) filter.classes = req.query.className;
  res.json(await Subject.find(filter).sort({ sortOrder: 1, name: 1 }).lean());
}));

publicRoutes.get('/courses', asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { active: true };
  if (typeof req.query.className === 'string' && req.query.className) filter.className = req.query.className;
  res.json(await Course.find(filter)
    .populate('subjects', 'name slug')
    .populate('boards', 'name slug')
    .sort({ sortOrder: 1, title: 1 })
    .lean());
}));

publicRoutes.get('/courses/:slug', asyncHandler(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug, active: true })
    .populate('subjects', 'name slug classes')
    .populate('boards', 'name slug')
    .lean();
  if (!course) throw new HttpError(404, 'Course not found');
  res.json(course);
}));
publicRoutes.get('/notices', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const filter: Record<string, unknown> = { published: true, publishDate: { $lte: new Date() } };
  if (typeof req.query.category === 'string' && req.query.category) filter.category = req.query.category;
  res.json(await Notice.find(filter).sort({ publishDate: -1 }).limit(limit).lean());
}));

publicRoutes.get('/gallery', asyncHandler(async (_req, res) => {
  res.json(await GalleryItem.find({ published: true }).sort({ sortOrder: 1, createdAt: -1 }).lean());
}));

publicRoutes.get('/testimonials', asyncHandler(async (_req, res) => {
  res.json(await Testimonial.find({ published: true }).sort({ sortOrder: 1, createdAt: -1 }).lean());
}));

publicRoutes.get('/teachers', asyncHandler(async (_req, res) => {
  const profiles = await TeacherProfile.find({ approved: true })
    .populate('user', 'name email')
    .populate('subjects', 'name slug')
    .sort({ experienceYears: -1 })
    .lean();
  res.json(profiles.map((profile: any) => ({
    id: profile._id.toString(),
    name: profile.user?.name,
    email: profile.user?.email,
    qualification: profile.qualification,
    bio: profile.bio,
    photoUrl: profile.photoUrl,
    subjects: profile.subjects,
    classes: profile.classes,
    experienceYears: profile.experienceYears
  })));
}));

publicRoutes.get('/materials', optionalAuth, asyncHandler(async (req, res) => {
  const query = materialQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = { ...publishedFilter() };
  if (query.className) filter.className = query.className;
  if (query.subject) filter.subject = query.subject;
  if (query.board) filter.board = query.board;
  if (query.chapter) filter.chapter = query.chapter;
  if (query.materialType) filter.materialType = query.materialType;
  if (query.accessType) filter.accessType = query.accessType;
  if (query.featured) filter.featured = query.featured === 'true';
  if (query.search) filter.$text = { $search: query.search };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Material.find(filter)
      .populate('subject', 'name slug')
      .populate('board', 'name slug')
      .sort(SORT_MAP[query.sort])
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Material.countDocuments(filter)
  ]);

  const payload = await Promise.all(items.map(async (item: any) => {
    const access = await resolveMaterialAccess(item, req.user);
    return toPublicMaterial(item, {
      hasAccess: access.allowed,
      accessReason: access.allowed ? undefined : access.reason
    });
  }));

  res.json({ items: payload, total, page: query.page, limit: query.limit, pages: Math.max(1, Math.ceil(total / query.limit)) });
}));

publicRoutes.get('/materials/:id', optionalAuth, asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id)
    .populate('subject', 'name slug')
    .populate('board', 'name slug');
  if (!material) throw new HttpError(404, 'Material not found');
  const isOwner = Boolean(req.user) && (req.user!.role === 'ADMIN' || material.uploadedBy.toString() === req.user!.id);
  if ((material.status !== 'PUBLISHED' || material.visibility !== 'PUBLIC') && !isOwner) {
    throw new HttpError(404, 'Material not found');
  }
  const access = await resolveMaterialAccess(material, req.user);
  res.json(toPublicMaterial(material.toObject(), { hasAccess: access.allowed, accessReason: access.reason }));
}));

publicRoutes.post('/enquiries', asyncHandler(async (req, res) => {
  const data = enquirySchema.parse(req.body);
  const enquiry = await Enquiry.create({ ...data, board: data.board || null });
  res.status(201).json({ id: enquiry._id.toString(), message: 'Thank you! Our team will contact you shortly.' });
}));

