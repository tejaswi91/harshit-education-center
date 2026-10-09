import { z } from 'zod';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { User, hashPassword } from './models/User.js';

const recoveryInputSchema = z.object({
  ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  ADMIN_PASSWORD: z.string().min(8).max(128),
  ADMIN_NAME: z.string().trim().min(2).max(120).optional()
});

async function recoverAdmin() {
  const input = recoveryInputSchema.parse(process.env);
  await connectDatabase();

  const existingUser = await User.findOne({ email: input.ADMIN_EMAIL }).select('+passwordHash');
  if (existingUser && existingUser.role !== 'ADMIN') {
    throw new Error(`Refusing to promote existing ${existingUser.role} account ${input.ADMIN_EMAIL}; choose another email`);
  }

  const passwordHash = await hashPassword(input.ADMIN_PASSWORD);
  if (existingUser) {
    existingUser.passwordHash = passwordHash;
    existingUser.isActive = true;
    if (input.ADMIN_NAME) existingUser.name = input.ADMIN_NAME;
    await existingUser.save();
  } else {
    await User.create({
      name: input.ADMIN_NAME ?? 'Institute Administrator',
      email: input.ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });
  }

  console.log(`Administrator ${input.ADMIN_EMAIL} ${existingUser ? 'recovered' : 'created'} in database "${User.db.name}".`);
}

recoverAdmin()
  .catch((error: unknown) => {
    console.error('Admin recovery failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disconnectDatabase();
    } catch (error) {
      console.error('Failed to disconnect from MongoDB after admin recovery', error);
      process.exitCode = 1;
    }
  });
