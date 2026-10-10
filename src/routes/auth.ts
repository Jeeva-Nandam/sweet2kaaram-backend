import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env';
import { User } from '../models/User';
import { signToken, requireCustomer } from '../middleware/auth';
import { verifyGoogleCredential } from '../services/google';
import { HttpError, ah, parse } from '../utils/http';

const r = Router();

// A fixed dummy hash so a wrong email takes as long to reject as a wrong password.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO7sVq1o8Qx5gQ1q5v5mXk0q2m8b5V0sa';

/** Customer login: verifies a real Google ID token, then creates/updates the account. */
r.post('/google', ah(async (req, res) => {
  const { credential } = parse(z.object({ credential: z.string().min(20) }), req.body);
  const g = await verifyGoogleCredential(credential);
  const user = await User.findOneAndUpdate(
    { googleId: g.googleId },
    { $set: { email: g.email, name: g.name, picture: g.picture, lastLoginAt: new Date() }, $setOnInsert: { googleId: g.googleId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const token = signToken({ sub: String(user!._id), role: 'customer', email: g.email }, '14d');
  res.json({ token, user });
}));

/** Admin login: credentials live only in server environment variables (hashed password). */
r.post('/admin/login', ah(async (req, res) => {
  const { email, password } = parse(z.object({ email: z.string().trim().email(), password: z.string().min(1).max(200) }), req.body);
  if (!env.adminEmail || !env.adminPasswordHash) {
    throw new HttpError(500, 'Admin login is not configured on the server (ADMIN_EMAIL / ADMIN_PASSWORD_HASH)');
  }
  const emailOk = email.toLowerCase() === env.adminEmail;
  const passOk = await bcrypt.compare(password, emailOk ? env.adminPasswordHash : DUMMY_HASH);
  if (!emailOk || !passOk) throw new HttpError(401, 'Invalid email or password');
  const token = signToken({ sub: 'admin', role: 'admin', email: env.adminEmail }, '8h');
  res.json({ token, admin: { email: env.adminEmail, role: 'admin' } });
}));

r.get('/me', requireCustomer, (req, res) => res.json({ user: req.user }));

export default r;
