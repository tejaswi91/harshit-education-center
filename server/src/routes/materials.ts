import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { Material } from '../models/Material.js';
import { Purchase } from '../models/Purchase.js';
import { Download } from '../models/Download.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { storage } from '../services/storage.js';
import {
  findMaterialOr404,
  materialAccessMessage,
  resolveMaterialAccess,
  toPublicMaterial
} from '../services/access.js';

export const materialRoutes = Router();

/** Express 5 types route params as `string | string[]`; every id here is a single value. */
const paramId = (value: string | string[]) => (Array.isArray(value) ? value[0] : value);

materialRoutes.get('/me/downloads', requireAuth, asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const downloads = await Download.find({ user: req.user!.id })
    .populate('material', 'title className materialType file accessType thumbnail')
    .sort({ downloadedAt: -1 })
    .limit(limit)
    .lean();
  res.json(downloads.map((row: any) => ({
    id: row._id.toString(),
    downloadedAt: row.downloadedAt,
    material: row.material ? toPublicMaterial(row.material) : null
  })).filter((row: any) => row.material));
}));

materialRoutes.get('/me/favourites', requireAuth, asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user!.id }).populate({
    path: 'favouriteMaterials',
    populate: { path: 'subject', select: 'name slug' }
  });
  res.json((profile?.favouriteMaterials ?? []).map((material: any) => toPublicMaterial(material)));
}));

materialRoutes.post('/:id/favourite', requireAuth, asyncHandler(async (req, res) => {
  const material = await findMaterialOr404(paramId(req.params.id));
  await StudentProfile.updateOne(
    { user: req.user!.id },
    { $addToSet: { favouriteMaterials: material._id } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ message: 'Added to favourites', favourited: true });
}));

materialRoutes.delete('/:id/favourite', requireAuth, asyncHandler(async (req, res) => {
  await StudentProfile.updateOne(
    { user: req.user!.id },
    { $pull: { favouriteMaterials: paramId(req.params.id) } }
  );
  res.json({ message: 'Removed from favourites', favourited: false });
}));

materialRoutes.get('/me/purchases', requireAuth, asyncHandler(async (req, res) => {
  const purchases = await Purchase.find({ student: req.user!.id })
    .populate('material', 'title className materialType file accessType price thumbnail')
    .sort({ createdAt: -1 })
    .lean();
  res.json(purchases.map((purchase: any) => ({
    id: purchase._id.toString(),
    amount: purchase.amount,
    currency: purchase.currency,
    paymentStatus: purchase.paymentStatus,
    transactionId: purchase.transactionId,
    purchaseDate: purchase.purchaseDate,
    expiryDate: purchase.expiryDate,
    material: purchase.material ? toPublicMaterial(purchase.material) : null
  })).filter((row: any) => row.material));
}));

materialRoutes.post('/:id/purchase', requireAuth, asyncHandler(async (req, res) => {
  const material = await findMaterialOr404(paramId(req.params.id));
  if (material.accessType !== 'PAID') throw new HttpError(400, 'This material does not require a payment');
  if (material.price <= 0) throw new HttpError(400, 'This material is free of cost');

  const existing = await Purchase.findOne({ student: req.user!.id, material: material._id });
  if (existing?.paymentStatus === 'PAID') {
    return res.json({ purchase: { id: existing._id.toString(), paymentStatus: existing.paymentStatus }, message: 'You already own this material' });
  }

  const transactionId = `HEC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const purchase = await Purchase.findOneAndUpdate(
    { student: req.user!.id, material: material._id },
    {
      $set: {
        amount: material.price,
        currency: 'INR',
        paymentStatus: 'PAID',
        transactionId,
        purchaseDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({
    purchase: { id: purchase._id.toString(), paymentStatus: purchase.paymentStatus, transactionId: purchase.transactionId },
    message: 'Payment successful. You can now download this material.'
  });
}));



materialRoutes.get('/:id/download', requireAuth, asyncHandler(async (req, res) => {
  const material = await findMaterialOr404(paramId(req.params.id));
  const access = await resolveMaterialAccess(material, req.user);
  if (!access.allowed) {
    const status = access.reason === 'login' ? 401 : 402;
    throw new HttpError(status, materialAccessMessage(access.reason));
  }

  const file = await storage.getDownload(material.file.key);
  await Promise.all([
    Material.updateOne({ _id: material._id }, { $inc: { downloadCount: 1 } }),
    Download.create({ material: material._id, user: req.user!.id, downloadedAt: new Date() })
  ]);

  const disposition = `attachment; filename="${encodeURIComponent(material.file.originalName)}"`;
  if (file.path) {
    res.setHeader('Content-Type', material.file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', disposition);
    return res.download(file.path);
  }
  if (file.stream) {
    res.setHeader('Content-Type', file.contentType || material.file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', disposition);
    return file.stream.pipe(res);
  }
  throw new HttpError(501, 'This storage provider is not configured yet');
}));
