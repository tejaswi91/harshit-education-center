import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { signToken } from '../utils/jwt.js';
import { User, hashPassword } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { TeacherProfile } from '../models/TeacherProfile.js';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '../validators/auth.js';

export const authRoutes = Router();

function sessionPayload(user: InstanceType<typeof User>) {
  return {
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    token: signToken({ sub: user._id.toString(), role: user.role })
  };
}

authRoutes.post('/register', asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new HttpError(409, 'An account with this email already exists');

  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    role: data.role
  });

  if (data.role === 'STUDENT') {
    await StudentProfile.create({
      user: user._id,
      className: data.className || 'Class 1',
      board: data.board || null,
      schoolName: data.schoolName,
      guardianName: data.guardianName,
      mobile: data.mobile
    });
  } else {
    await TeacherProfile.create({
      user: user._id,
      qualification: data.qualification,
      bio: data.bio,
      approved: false
    });
  }

  res.status(201).json(sessionPayload(user));
}));

authRoutes.post('/login', asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await User.findOne({ email: data.email }).select('+passwordHash');
  if (!user || !(await user.comparePassword(data.password))) {
    throw new HttpError(401, 'Email or password is incorrect');
  }
  if (!user.isActive) throw new HttpError(403, 'This account has been disabled. Please contact the institute.');
  user.lastLogin = new Date();
  await user.save();
  res.json(sessionPayload(user));
}));

authRoutes.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new HttpError(404, 'Account not found');
  const profile = user.role === 'STUDENT'
    ? await StudentProfile.findOne({ user: user._id })
    : await TeacherProfile.findOne({ user: user._id });
  res.json({ user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role, lastLogin: user.lastLogin }, profile });
}));

authRoutes.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const data = updateProfileSchema.parse(req.body);
  const user = await User.findById(req.user!.id);
  if (!user) throw new HttpError(404, 'Account not found');
  if (data.name) user.name = data.name;
  await user.save();

  if (user.role === 'STUDENT') {
    const profile = await StudentProfile.findOneAndUpdate(
      { user: user._id },
      { $set: { className: data.className, board: data.board, schoolName: data.schoolName, guardianName: data.guardianName, mobile: data.mobile } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role }, profile });
  }
  const profile = await TeacherProfile.findOneAndUpdate(
    { user: user._id },
    { $set: { qualification: data.qualification, bio: data.bio, photoUrl: data.photoUrl } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role }, profile });
}));

authRoutes.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const data = changePasswordSchema.parse(req.body);
  const user = await User.findById(req.user!.id).select('+passwordHash');
  if (!user) throw new HttpError(404, 'Account not found');
  if (!(await user.comparePassword(data.currentPassword))) throw new HttpError(401, 'Current password is incorrect');
  user.passwordHash = await hashPassword(data.newPassword);
  await user.save();
  res.json({ message: 'Password updated successfully' });
}));
