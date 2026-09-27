import { HttpError } from '../utils/httpError.js';
import type { TokenRole } from '../utils/jwt.js';
import { Material, type MaterialDocument } from '../models/Material.js';
import { Purchase } from '../models/Purchase.js';

export const CLASS_LEVELS = [
  { key: 'Nursery', label: 'Nursery', group: 'LKG - UKG', tone: 'rose' },
  { key: 'LKG', label: 'LKG', group: 'LKG - UKG', tone: 'rose' },
  { key: 'UKG', label: 'UKG', group: 'LKG - UKG', tone: 'rose' },
  { key: 'Class 1', label: 'Class 1', group: 'Class 1 - 5', tone: 'orange' },
  { key: 'Class 2', label: 'Class 2', group: 'Class 1 - 5', tone: 'orange' },
  { key: 'Class 3', label: 'Class 3', group: 'Class 1 - 5', tone: 'orange' },
  { key: 'Class 4', label: 'Class 4', group: 'Class 1 - 5', tone: 'orange' },
  { key: 'Class 5', label: 'Class 5', group: 'Class 1 - 5', tone: 'orange' },
  { key: 'Class 6', label: 'Class 6', group: 'Class 6 - 8', tone: 'emerald' },
  { key: 'Class 7', label: 'Class 7', group: 'Class 6 - 8', tone: 'emerald' },
  { key: 'Class 8', label: 'Class 8', group: 'Class 6 - 8', tone: 'emerald' },
  { key: 'Class 9', label: 'Class 9', group: 'Class 9 - 10', tone: 'sky' },
  { key: 'Class 10', label: 'Class 10', group: 'Class 9 - 10', tone: 'sky' },
  { key: 'Class 11', label: 'Class 11', group: 'Class 11 - 12', tone: 'violet' },
  { key: 'Class 12', label: 'Class 12', group: 'Class 11 - 12', tone: 'violet' }
] as const;

export const DEFAULT_BOARDS = [
  { name: 'CBSE', slug: 'cbse', description: 'Central Board of Secondary Education' },
  { name: 'ICSE', slug: 'icse', description: 'Council for the Indian School Certificate Examinations' },
  { name: 'State Board', slug: 'state-board', description: 'State / regional boards' }
] as const;

export const DEFAULT_SUBJECTS = [
  { name: 'English', slug: 'english' },
  { name: 'Hindi', slug: 'hindi' },
  { name: 'Mathematics', slug: 'mathematics' },
  { name: 'Science', slug: 'science' },
  { name: 'Social Science', slug: 'social-science' },
  { name: 'Computer Science', slug: 'computer-science' },
  { name: 'Sanskrit', slug: 'sanskrit' }
] as const;

function isAdmin(role?: TokenRole) {
  return role === 'ADMIN';
}

/** Filters that keep drafts, private listings and non-public statuses off public endpoints. */
export function publishedFilter() {
  return { status: 'PUBLISHED' as const, visibility: 'PUBLIC' as const };
}

export function assertCanManageMaterial(user: Express.User, material: MaterialDocument, canManageAll = false) {
  if (isAdmin(user.role)) return;
  if (user.role !== 'TEACHER') throw new HttpError(403, 'You do not have permission for this action');
  if (canManageAll) return;
  if (material.uploadedBy.toString() !== user.id) throw new HttpError(403, 'You can only manage materials you uploaded');
}

/**
 * Decides whether a visitor may see and download a material.
 * PUBLIC_FREE is open to everyone, STUDENT_ONLY needs any signed-in account,
 * PAID needs a confirmed purchase. Admins and owners always pass.
 */
export async function resolveMaterialAccess(material: MaterialDocument, user?: Express.User) {
  if (user && (isAdmin(user.role) || material.uploadedBy.toString() === user.id)) {
    return { allowed: true, reason: 'owner' as const };
  }
  if (material.status !== 'PUBLISHED' || material.visibility !== 'PUBLIC') {
    return { allowed: false, reason: 'unavailable' as const };
  }
  if (material.accessType === 'PUBLIC_FREE') return { allowed: true, reason: 'free' as const };
  if (material.accessType === 'STUDENT_ONLY') {
    if (!user) return { allowed: false, reason: 'login' as const };
    return { allowed: true, reason: 'student' as const };
  }
  if (!user) return { allowed: false, reason: 'login' as const };
  const purchase = await Purchase.findOne({
    student: user.id,
    material: material._id,
    paymentStatus: 'PAID'
  });
  if (!purchase) return { allowed: false, reason: 'purchase' as const };
  if (purchase.expiryDate && purchase.expiryDate.getTime() < Date.now()) {
    return { allowed: false, reason: 'expired' as const };
  }
  return { allowed: true, reason: 'purchased' as const };
}

export function materialAccessMessage(reason: string) {
  switch (reason) {
    case 'login': return 'Please sign in to download this material';
    case 'purchase': return 'Purchase this material to start downloading';
    case 'expired': return 'Your access to this material has expired';
    case 'unavailable': return 'This material is not available';
    default: return 'You do not have access to this material';
  }
}

export function toPublicMaterial(material: any, extra: Record<string, unknown> = {}) {
  const file = material.file ?? {};
  return {
    id: material._id?.toString(),
    title: material.title,
    description: material.description,
    className: material.className,
    subject: material.subject,
    board: material.board ?? null,
    chapter: material.chapter ?? '',
    materialType: material.materialType,
    accessType: material.accessType,
    price: material.price,
    status: material.status,
    featured: material.featured,
    downloadCount: material.downloadCount,
    uploadedDate: material.uploadedDate,
    fileName: file.originalName,
    fileSize: file.size,
    mimeType: file.mimeType,
    thumbnail: material.thumbnail?.key ? `/api/files/${material.thumbnail.key}` : null,
    ...extra
  };
}

export async function findMaterialOr404(id: string) {
  const material = await Material.findById(id);
  if (!material) throw new HttpError(404, 'Material not found');
  return material;
}
