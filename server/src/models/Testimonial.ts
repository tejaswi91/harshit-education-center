import mongoose, { Schema, model } from 'mongoose';

export interface TestimonialDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  quote: string;
  className: string;
  photoUrl?: string;
  published: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const testimonialSchema = new Schema<TestimonialDocument>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  quote: { type: String, required: true, trim: true, maxlength: 800 },
  className: { type: String, required: true, trim: true },
  photoUrl: { type: String, trim: true },
  published: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

export const Testimonial = model<TestimonialDocument>('Testimonial', testimonialSchema);

