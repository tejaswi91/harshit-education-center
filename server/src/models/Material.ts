import mongoose, { Schema, model } from 'mongoose';

export const MATERIAL_TYPES = ['NOTES', 'WORKSHEET', 'QUESTION_PAPER', 'SAMPLE_PAPER', 'PREVIOUS_YEAR_PAPER', 'ASSIGNMENT', 'REVISION_MATERIAL', 'PRACTICE_SHEET', 'OTHER'] as const;
export const ACCESS_TYPES = ['PUBLIC_FREE', 'STUDENT_ONLY', 'PAID'] as const;
export const MATERIAL_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type MaterialType = typeof MATERIAL_TYPES[number];
export type AccessType = typeof ACCESS_TYPES[number];
export type MaterialStatus = typeof MATERIAL_STATUSES[number];

export interface FileMetadata {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface MaterialDocument {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  className: string;
  subject: mongoose.Types.ObjectId;
  board?: mongoose.Types.ObjectId;
  chapter?: string;
  materialType: MaterialType;
  file: FileMetadata;
  thumbnail?: FileMetadata;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedDate: Date;
  visibility: 'PUBLIC' | 'PRIVATE';
  accessType: AccessType;
  price: number;
  status: MaterialStatus;
  featured: boolean;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<FileMetadata>({
  key: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 0 }
}, { _id: false });

const materialSchema = new Schema<MaterialDocument>({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  className: { type: String, required: true, trim: true, index: true },
  subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
  board: { type: Schema.Types.ObjectId, ref: 'Board', default: null, index: true },
  chapter: { type: String, trim: true, maxlength: 180, index: true },
  materialType: { type: String, enum: MATERIAL_TYPES, required: true, index: true },
  file: { type: fileSchema, required: true },
  thumbnail: { type: fileSchema, default: null },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  uploadedDate: { type: Date, default: Date.now, index: true },
  visibility: { type: String, enum: ['PUBLIC', 'PRIVATE'], required: true, index: true },
  accessType: { type: String, enum: ACCESS_TYPES, required: true, index: true },
  price: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: MATERIAL_STATUSES, default: 'DRAFT', index: true },
  featured: { type: Boolean, default: false, index: true },
  downloadCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

materialSchema.index({ title: 'text', description: 'text', chapter: 'text' });
materialSchema.index({ className: 1, subject: 1, board: 1, materialType: 1, status: 1 });

export const Material = model<MaterialDocument>('Material', materialSchema);

