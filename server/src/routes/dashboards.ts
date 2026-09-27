import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { Material, type FileMetadata } from '../models/Material.js';
import { Download } from '../models/Download.js';
import { Purchase } from '../models/Purchase.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { storage } from '../services/storage.js';
import { upload } from '../middleware/upload.js';
import { assertCanManageMaterial, toPublicMaterial } from '../services/access.js';
import { materialBodySchema, materialQuerySchema, materialUpdateSchema } from '../validators/index.js';

export const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth);

async function teacherScope(user: Express.User) {
  const profile = await TeacherProfile.findOne({ user: user.id });
  const manageAll = profile?.canManageAllMaterials ?? false;
  return { profile, manageAll, filter: user.role === 'ADMIN' || manageAll ? {} : { uploadedBy: user.id } };
}

dashboardRoutes.get('/summary', requireRole('STUDENT', 'TEACHER', 'ADMIN'), asyncHandler(async (req, res) => {
  const user = req.user!;
  if (user.role === 'STUDENT') {
    const [profile, downloadCount, purchases, favourites, recent] = await Promise.all([
      StudentProfile.findOne({ user: user.id }).populate('board', 'name slug').lean(),
      Download.countDocuments({ user: user.id }),
      Purchase.find({ student: user.id, paymentStatus: 'PAID' }).sort({ purchaseDate: -1 }).limit(5)
        .populate('material', 'title className materialType file accessType price thumbnail').lean(),
      StudentProfile.findOne({ user: user.id }).select('favouriteMaterials').lean(),
      Download.find({ user: user.id }).sort({ downloadedAt: -1 }).limit(5)
        .populate('material', 'title className materialType file accessType thumbnail').lean()
    ]);
    return res.json({
      role: 'STUDENT',
      profile,
      stats: {
        downloads: downloadCount,
        purchases: purchases.length,
        favourites: profile?.favouriteMaterials?.length ?? 0
      },
      purchases: purchases.map((row: any) => ({
        id: row._id.toString(),
        amount: row.amount,
        purchaseDate: row.purchaseDate,
        material: row.material ? toPublicMaterial(row.material) : null
      })).filter((row: any) => row.material),
      recentDownloads: recent.map((row: any) => ({
        id: row._id.toString(),
        downloadedAt: row.downloadedAt,
        material: row.material ? toPublicMaterial(row.material) : null
      })).filter((row: any) => row.material)
    });
  }

  const { profile, filter } = await teacherScope(user);
  const [total, published, drafts, downloads, revenue] = await Promise.all([
    Material.countDocuments(filter),
    Material.countDocuments({ ...filter, status: 'PUBLISHED' }),
    Material.countDocuments({ ...filter, status: 'DRAFT' }),
    Download.countDocuments({ material: { $in: await Material.find(filter).distinct('_id') } }),
    Purchase.aggregate([
      { $match: { paymentStatus: 'PAID', material: { $in: await Material.find(filter).distinct('_id') } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);
  res.json({
    role: user.role,
    profile,
    stats: { total, published, drafts, downloads, revenue: revenue[0]?.total ?? 0 }
  });
}));

dashboardRoutes.get('/materials', requireRole('TEACHER', 'ADMIN'), asyncHandler(async (req, res) => {
  const query = materialQuerySchema.parse(req.query);
  const { filter } = await teacherScope(req.user!);
  const conditions: Record<string, unknown> = { ...filter };
  if (query.status) conditions.status = query.status;
  if (query.className) conditions.className = query.className;
  if (query.subject) conditions.subject = query.subject;
  if (query.search) conditions.title = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Material.find(conditions).populate('subject', 'name slug').populate('board', 'name slug')
      .sort({ uploadedDate: -1 }).skip(skip).limit(query.limit).lean(),
    Material.countDocuments(conditions)
  ]);
  res.json({ items: items.map((item: any) => toPublicMaterial(item)), total, page: query.page, limit: query.limit });
}));
const uploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

/** `uploadFields` uses multer's `.fields()`, so `req.files` is always keyed by field name. */
type UploadedFileMap = Record<string, Express.Multer.File[]>;

dashboardRoutes.post('/materials', requireRole('TEACHER', 'ADMIN'), uploadFields, asyncHandler(async (req, res) => {
  const data = materialBodySchema.parse(req.body);
  const files = req.files as UploadedFileMap | undefined;
  const mainFile = files?.file?.[0];
  if (!mainFile) throw new HttpError(400, 'Please attach a file to upload');

  /**
   * Files are tracked as soon as the storage adapter claims them so a failure
   * part-way through (for example a rejected database write) can roll the
   * already-stored files back instead of orphaning them on disk.
   */
  const stored: { key: string }[] = [];
  let material;
  try {
    const file = await storage.put(mainFile, 'materials');
    stored.push(file);
    const thumbFile = files?.thumbnail?.[0];
    const thumbnail = thumbFile ? await storage.put(thumbFile, 'thumbnails') : null;
    if (thumbnail) stored.push(thumbnail);

    material = await Material.create({
      ...data,
      file,
      thumbnail,
      uploadedBy: req.user!.id,
      uploadedDate: new Date()
    });
  } catch (error) {
    await Promise.all(stored.map((item) => storage.remove(item.key).catch(() => undefined)));
    throw error;
  }
  res.status(201).json(toPublicMaterial(material));
}));

dashboardRoutes.patch('/materials/:id', requireRole('TEACHER', 'ADMIN'), uploadFields, asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw new HttpError(404, 'Material not found');
  const { manageAll } = await teacherScope(req.user!);
  assertCanManageMaterial(req.user!, material, manageAll);

  const data = materialUpdateSchema.parse(req.body);
  const files = req.files as UploadedFileMap | undefined;
  const mainFile = files?.file?.[0];
  const thumbFile = files?.thumbnail?.[0];

  // Captured before the replacements are assigned, so the superseded files can
  // be deleted only once the document no longer refers to them.
  const superseded = [mainFile ? material.file.key : null, thumbFile ? material.thumbnail?.key ?? null : null];

  /**
   * Replacement files are stored first, the document is saved next, and the old
   * files are dropped last. That order keeps the row and its file consistent at
   * every step: a failure while storing or saving rolls the new files back and
   * leaves the original material downloadable, whereas deleting the old file
   * first would leave the row pointing at a file that no longer exists.
   */
  let replacement: (FileMetadata | null)[] = [null, null];
  try {
    if (mainFile) {
      replacement[0] = await storage.put(mainFile, 'materials');
      material.file = replacement[0];
    }
    if (thumbFile) {
      replacement[1] = await storage.put(thumbFile, 'thumbnails');
      material.thumbnail = replacement[1];
    }
    Object.assign(material, data);
    await material.save();
  } catch (error) {
    const rollback = replacement.filter((item): item is FileMetadata => item !== null);
    await Promise.all(rollback.map((item) => storage.remove(item.key).catch(() => undefined)));
    throw error;
  }

  // The row now points at the new keys, so the replaced files are safe to drop.
  // A failure here only leaves an unreferenced file behind, which is harmless.
  await Promise.all(superseded.filter((key): key is string => Boolean(key)).map((key) => storage.remove(key).catch(() => undefined)));

  res.json(toPublicMaterial(material));
}));

dashboardRoutes.delete('/materials/:id', requireRole('TEACHER', 'ADMIN'), asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw new HttpError(404, 'Material not found');
  const { manageAll } = await teacherScope(req.user!);
  assertCanManageMaterial(req.user!, material, manageAll);

  await storage.remove(material.file.key).catch(() => undefined);
  if (material.thumbnail?.key) await storage.remove(material.thumbnail.key).catch(() => undefined);
  await material.deleteOne();
  res.json({ message: 'Material deleted' });
}));

dashboardRoutes.get('/downloads', requireRole('TEACHER', 'ADMIN'), asyncHandler(async (req, res) => {
  const { filter } = await teacherScope(req.user!);
  const materialIds = await Material.find(filter).distinct('_id');
  const rows = await Download.find({ material: { $in: materialIds } })
    .populate('user', 'name email')
    .populate('material', 'title className materialType')
    .sort({ downloadedAt: -1 })
    .limit(200)
    .lean();
  res.json(rows.map((row: any) => ({
    id: row._id.toString(),
    downloadedAt: row.downloadedAt,
    user: row.user ? { name: row.user.name, email: row.user.email } : null,
    material: row.material ? { title: row.material.title, className: row.material.className, materialType: row.material.materialType } : null
  })));
}));

