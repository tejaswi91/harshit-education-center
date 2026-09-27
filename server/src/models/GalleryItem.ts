import mongoose, { Schema, model } from 'mongoose';

export interface GalleryItemDocument {
  _id: mongoose.Types.ObjectId;
  title: string;
  imageUrl: string;
  altText: string;
  category?: string;
  published: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const gallerySchema = new Schema<GalleryItemDocument>({
  title: { type: String, required: true, trim: true },
  imageUrl: { type: String, required: true, trim: true },
  altText: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, trim: true },
  published: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

export const GalleryItem = model<GalleryItemDocument>('GalleryItem', gallerySchema);

