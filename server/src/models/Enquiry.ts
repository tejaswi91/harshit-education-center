import mongoose, { Schema, model } from 'mongoose';

export interface EnquiryDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  mobile: string;
  email?: string;
  className: string;
  board?: mongoose.Types.ObjectId;
  message: string;
  status: 'NEW' | 'CONTACTED' | 'CLOSED';
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<EnquiryDocument>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  mobile: { type: String, required: true, trim: true, maxlength: 20 },
  email: { type: String, trim: true, lowercase: true },
  className: { type: String, required: true, trim: true },
  board: { type: Schema.Types.ObjectId, ref: 'Board', default: null },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['NEW', 'CONTACTED', 'CLOSED'], default: 'NEW', index: true }
}, { timestamps: true });

export const Enquiry = model<EnquiryDocument>('Enquiry', enquirySchema);

