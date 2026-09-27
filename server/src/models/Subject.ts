import mongoose, { Schema, model } from 'mongoose';

export interface SubjectDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  classes: string[];
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<SubjectDocument>({
  name: { type: String, required: true, trim: true, unique: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  classes: [{ type: String, trim: true }],
  active: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

export const Subject = model<SubjectDocument>('Subject', subjectSchema);

