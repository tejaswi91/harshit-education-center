import mongoose, { Schema, model } from 'mongoose';

export interface NoticeDocument {
  _id: mongoose.Types.ObjectId;
  title: string;
  body: string;
  category: 'ADMISSION' | 'EXAM' | 'MATERIAL' | 'GENERAL';
  published: boolean;
  publishDate: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const noticeSchema = new Schema<NoticeDocument>({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  body: { type: String, required: true, trim: true, maxlength: 4000 },
  category: { type: String, enum: ['ADMISSION', 'EXAM', 'MATERIAL', 'GENERAL'], default: 'GENERAL' },
  published: { type: Boolean, default: true, index: true },
  publishDate: { type: Date, default: Date.now, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export const Notice = model<NoticeDocument>('Notice', noticeSchema);

