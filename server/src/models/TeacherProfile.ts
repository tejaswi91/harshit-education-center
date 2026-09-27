import mongoose, { Schema, model } from 'mongoose';

export interface TeacherProfileDocument {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  qualification?: string;
  bio?: string;
  photoUrl?: string;
  subjects: mongoose.Types.ObjectId[];
  classes: string[];
  experienceYears: number;
  approved: boolean;
  canManageAllMaterials: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teacherProfileSchema = new Schema<TeacherProfileDocument>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  qualification: { type: String, trim: true, maxlength: 180 },
  bio: { type: String, trim: true, maxlength: 1000 },
  photoUrl: { type: String, trim: true },
  subjects: [{ type: Schema.Types.ObjectId, ref: 'Subject', default: [] }],
  classes: [{ type: String, trim: true }],
  experienceYears: { type: Number, min: 0, max: 60, default: 0 },
  approved: { type: Boolean, default: false, index: true },
  canManageAllMaterials: { type: Boolean, default: false }
}, { timestamps: true });

export const TeacherProfile = model<TeacherProfileDocument>('TeacherProfile', teacherProfileSchema);

