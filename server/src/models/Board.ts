import mongoose, { Schema, model } from 'mongoose';

export interface BoardDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const boardSchema = new Schema<BoardDocument>({
  name: { type: String, required: true, trim: true, unique: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true, maxlength: 500 },
  active: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

export const Board = model<BoardDocument>('Board', boardSchema);

