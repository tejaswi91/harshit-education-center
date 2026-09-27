import mongoose, { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

export const USER_ROLES = ['STUDENT', 'TEACHER', 'ADMIN'] as const;
export type UserRole = typeof USER_ROLES[number];

export interface UserDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: USER_ROLES, required: true, default: 'STUDENT', index: true },
  isActive: { type: Boolean, default: true, index: true },
  lastLogin: Date
}, { timestamps: true });

userSchema.methods.comparePassword = function comparePassword(password: string) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const output = ret as unknown as Record<string, unknown>;
    delete output.passwordHash;
    delete output.__v;
    return output;
  }
});

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export const User = model<UserDocument>('User', userSchema);
