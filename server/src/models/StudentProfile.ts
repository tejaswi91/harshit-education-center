import mongoose, { Schema, model } from 'mongoose';

export interface StudentProfileDocument {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  className: string;
  board?: mongoose.Types.ObjectId;
  schoolName?: string;
  guardianName?: string;
  mobile?: string;
  favouriteMaterials: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const studentProfileSchema = new Schema<StudentProfileDocument>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  className: { type: String, required: true, trim: true, index: true },
  board: { type: Schema.Types.ObjectId, ref: 'Board', default: null, index: true },
  schoolName: { type: String, trim: true, maxlength: 160 },
  guardianName: { type: String, trim: true, maxlength: 120 },
  mobile: { type: String, trim: true, maxlength: 20 },
  favouriteMaterials: [{ type: Schema.Types.ObjectId, ref: 'Material' }]
}, { timestamps: true });

export const StudentProfile = model<StudentProfileDocument>('StudentProfile', studentProfileSchema);

