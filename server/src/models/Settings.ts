import mongoose, { Schema, model } from 'mongoose';

export interface SettingsDocument {
  _id: mongoose.Types.ObjectId;
  instituteName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  socialLinks: { youtube?: string; instagram?: string; facebook?: string; linkedin?: string };
  logoUrl?: string;
  heroImageUrl?: string;
  admissionMessage: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<SettingsDocument>({
  instituteName: { type: String, default: 'Harshit Education Center' },
  tagline: { type: String, default: 'Learn Today • Lead Tomorrow' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  socialLinks: {
    youtube: String,
    instagram: String,
    facebook: String,
    linkedin: String
  },
  logoUrl: String,
  heroImageUrl: String,
  admissionMessage: { type: String, default: 'Admissions are open. Enquire today to begin your learning journey.' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const Settings = model<SettingsDocument>('Settings', settingsSchema);

