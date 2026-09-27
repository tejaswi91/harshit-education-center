import mongoose, { Schema, model } from 'mongoose';

export interface CourseDocument {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  className: string;
  description: string;
  subjects: mongoose.Types.ObjectId[];
  boards: mongoose.Types.ObjectId[];
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<CourseDocument>({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  className: { type: String, required: true, trim: true, index: true },
  description: { type: String, required: true, maxlength: 1200 },
  subjects: [{ type: Schema.Types.ObjectId, ref: 'Subject', default: [] }],
  boards: [{ type: Schema.Types.ObjectId, ref: 'Board', default: [] }],
  active: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

export const Course = model<CourseDocument>('Course', courseSchema);

