import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { User, hashPassword } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { Material } from '../models/Material.js';
import { Course } from '../models/Course.js';
import { Subject } from '../models/Subject.js';
import { Board } from '../models/Board.js';
import { Notice } from '../models/Notice.js';
import { GalleryItem } from '../models/GalleryItem.js';
import { Testimonial } from '../models/Testimonial.js';
import { Enquiry } from '../models/Enquiry.js';
import { Settings } from '../models/Settings.js';
import { Purchase } from '../models/Purchase.js';
import { Download } from '../models/Download.js';
import {
  boardSchema,
  courseSchema,
  gallerySchema,
  noticeSchema,
  settingsSchema,
  studentCreateSchema,
  subjectSchema,
  teacherCreateSchema,
  teacherReviewSchema,
  testimonialSchema,
  userUpdateSchema
} from '../validators/index.js';

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole('ADMIN'));

/** Generic CRUD factory so every content collection follows identical response shapes. */
function crud(Model: any, schema: { parse: (value: unknown) => any }, options: { label: string }) {
  const router = Router();

  router.get('/', asyncHandler(async (req, res) => {
    const conditions: Record<string, unknown> = {};
    if (typeof req.query.search === 'string' && req.query.search) {
      conditions.name = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (typeof req.query.status === 'string' && req.query.status) conditions.status = req.query.status;
    res.json(await Model.find(conditions).sort({ sortOrder: 1, createdAt: -1 }).lean());
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const payload = schema.parse(req.body);
    // Models that track an author (for example Notice.createdBy) require one, and
    // the public payload never carries it, so stamp the signed-in admin.
    const document = Model.schema.path('createdBy') ? { ...payload, createdBy: req.user!.id } : payload;
    res.status(201).json(await Model.create(document));
  }));

  router.patch('/:id', asyncHandler(async (req, res) => {
    const item = await Model.findByIdAndUpdate(req.params.id, { $set: schema.parse(req.body) }, { new: true, runValidators: true });
    if (!item) throw new HttpError(404, `${options.label} not found`);
    res.json(item);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const item = await Model.findByIdAndDelete(req.params.id);
    if (!item) throw new HttpError(404, `${options.label} not found`);
    res.json({ message: `${options.label} deleted` });
  }));

  return router;
}

adminRoutes.use('/courses', crud(Course, courseSchema, { label: 'Course' }));
adminRoutes.use('/subjects', crud(Subject, subjectSchema, { label: 'Subject' }));
adminRoutes.use('/boards', crud(Board, boardSchema, { label: 'Board' }));
adminRoutes.use('/notices', crud(Notice, noticeSchema, { label: 'Notice' }));
adminRoutes.use('/gallery', crud(GalleryItem, gallerySchema, { label: 'Gallery item' }));
adminRoutes.use('/testimonials', crud(Testimonial, testimonialSchema, { label: 'Testimonial' }));
adminRoutes.get('/settings', asyncHandler(async (_req, res) => {
  res.json((await Settings.findOne().lean()) ?? {});
}));

adminRoutes.put('/settings', asyncHandler(async (req, res) => {
  const data = settingsSchema.parse(req.body);
  const settings = await Settings.findOneAndUpdate(
    {},
    { $set: { ...data, updatedBy: req.user!.id } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json(settings);
}));

adminRoutes.get('/materials', asyncHandler(async (req, res) => {
  const conditions: Record<string, unknown> = {};
  if (typeof req.query.status === 'string' && req.query.status) conditions.status = req.query.status;
  if (typeof req.query.className === 'string' && req.query.className) conditions.className = req.query.className;
  if (typeof req.query.search === 'string' && req.query.search) {
    conditions.title = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const [items, total] = await Promise.all([
    Material.find(conditions)
      .populate('subject', 'name slug')
      .populate('board', 'name slug')
      .populate('uploadedBy', 'name email')
      .sort({ uploadedDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Material.countDocuments(conditions)
  ]);
  res.json({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}));

adminRoutes.get('/enquiries', asyncHandler(async (req, res) => {
  const conditions: Record<string, unknown> = {};
  if (typeof req.query.status === 'string' && req.query.status) conditions.status = req.query.status;
  res.json(await Enquiry.find(conditions).populate('board', 'name slug').sort({ createdAt: -1 }).limit(200).lean());
}));

adminRoutes.patch('/enquiries/:id', asyncHandler(async (req, res) => {
  const status = String(req.body?.status ?? '');
  if (!['NEW', 'CONTACTED', 'CLOSED'].includes(status)) throw new HttpError(422, 'Status must be NEW, CONTACTED or CLOSED');
  const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
  if (!enquiry) throw new HttpError(404, 'Enquiry not found');
  res.json(enquiry);
}));

adminRoutes.delete('/enquiries/:id', asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
  if (!enquiry) throw new HttpError(404, 'Enquiry not found');
  res.json({ message: 'Enquiry deleted' });
}));

adminRoutes.get('/purchases', asyncHandler(async (_req, res) => {
  const purchases = await Purchase.find()
    .populate('student', 'name email')
    .populate('material', 'title className materialType')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json(purchases);
}));

adminRoutes.get('/users', asyncHandler(async (req, res) => {
  const conditions: Record<string, unknown> = {};
  if (typeof req.query.role === 'string' && req.query.role) conditions.role = req.query.role;
  if (typeof req.query.search === 'string' && req.query.search) {
    const safe = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.$or = [{ name: new RegExp(safe, 'i') }, { email: new RegExp(safe, 'i') }];
  }
  res.json(await User.find(conditions).sort({ createdAt: -1 }).limit(200).lean());
}));

adminRoutes.patch('/users/:id', asyncHandler(async (req, res) => {
  const data = userUpdateSchema.parse(req.body);
  if (req.params.id === req.user!.id && data.role && data.role !== 'ADMIN') {
    throw new HttpError(400, 'You cannot remove your own admin role');
  }
  const update: Record<string, unknown> = { name: data.name, role: data.role, isActive: data.isActive };
  if (data.password) update.passwordHash = await hashPassword(data.password);
  const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
  if (!user) throw new HttpError(404, 'User not found');
  res.json(user);
}));

adminRoutes.get('/teachers', asyncHandler(async (_req, res) => {
  const profiles = await TeacherProfile.find()
    .populate('user', 'name email isActive createdAt')
    .populate('subjects', 'name slug')
    .sort({ approved: 1, createdAt: -1 })
    .lean();
  res.json(profiles);
}));

adminRoutes.post('/teachers', asyncHandler(async (req, res) => {
  const data = teacherCreateSchema.parse(req.body);
  if (await User.exists({ email: data.email })) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    role: 'TEACHER'
  });
  const profile = await TeacherProfile.create({
    user: user._id,
    qualification: data.qualification,
    bio: data.bio,
    approved: true
  });
  res.status(201).json({ user, profile });
}));

adminRoutes.patch('/teachers/:id', asyncHandler(async (req, res) => {
  const data = teacherReviewSchema.parse(req.body);
  const profile = await TeacherProfile.findByIdAndUpdate(
    req.params.id,
    { $set: { approved: data.approved, canManageAllMaterials: data.canManageAllMaterials } },
    { new: true }
  ).populate('user', 'name email');
  if (!profile) throw new HttpError(404, 'Teacher profile not found');
  res.json(profile);
}));

adminRoutes.get('/students', asyncHandler(async (_req, res) => {
  res.json(await StudentProfile.find().populate('user', 'name email isActive createdAt').populate('board', 'name slug').sort({ createdAt: -1 }).lean());
}));

adminRoutes.post('/students', asyncHandler(async (req, res) => {
  const data = studentCreateSchema.parse(req.body);
  if (await User.exists({ email: data.email })) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    role: 'STUDENT'
  });
  const profile = await StudentProfile.create({
    user: user._id,
    className: data.className,
    board: data.board ?? null,
    schoolName: data.schoolName,
    guardianName: data.guardianName,
    mobile: data.mobile
  });
  res.status(201).json({ user, profile });
}));

adminRoutes.get('/overview', asyncHandler(async (_req, res) => {
  const [users, students, teachers, pendingTeachers, materials, published, drafts, enquiries, paidRevenue, downloads] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'STUDENT' }),
    User.countDocuments({ role: 'TEACHER' }),
    TeacherProfile.countDocuments({ approved: false }),
    Material.countDocuments(),
    Material.countDocuments({ status: 'PUBLISHED' }),
    Material.countDocuments({ status: 'DRAFT' }),
    Enquiry.countDocuments({ status: 'NEW' }),
    Purchase.aggregate([{ $match: { paymentStatus: 'PAID' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Download.countDocuments()
  ]);
  res.json({
    users, students, teachers, pendingTeachers, materials, published, drafts,
    newEnquiries: enquiries,
    revenue: paidRevenue[0]?.total ?? 0,
    downloads
  });
}));
