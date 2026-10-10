import { Router } from 'express';
import { z } from 'zod';
import { requireCustomer } from '../middleware/auth';
import { HttpError, ah, parse } from '../utils/http';

const r = Router();
r.use(requireCustomer);

const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');
const addressInput = z.object({
  label: z.string().trim().max(30).default('Home'),
  name: z.string().trim().min(2, 'Enter the recipient name').max(80),
  phone,
  line1: z.string().trim().min(5, 'Enter the full street address').max(200),
  landmark: z.string().trim().max(120).default(''),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  isDefault: z.boolean().default(false),
});

r.put('/profile', ah(async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2).max(80).optional(), phone: phone.optional() }), req.body);
  Object.assign(req.user, body);
  await req.user.save();
  res.json(req.user);
}));

r.get('/addresses', (req, res) => res.json(req.user.addresses));

r.post('/addresses', ah(async (req, res) => {
  const body = parse(addressInput, req.body);
  const u = req.user;
  if (u.addresses.length >= 10) throw new HttpError(400, 'You can save up to 10 addresses');
  if (u.addresses.length === 0) body.isDefault = true;
  if (body.isDefault) u.addresses.forEach((a: any) => (a.isDefault = false));
  u.addresses.push(body);
  await u.save();
  res.status(201).json(u.addresses);
}));

r.put('/addresses/:id', ah(async (req, res) => {
  const body = parse(addressInput, req.body);
  const u = req.user;
  const a = u.addresses.id(req.params.id);
  if (!a) throw new HttpError(404, 'Address not found');
  if (body.isDefault) u.addresses.forEach((x: any) => (x.isDefault = false));
  a.set(body);
  await u.save();
  res.json(u.addresses);
}));

r.delete('/addresses/:id', ah(async (req, res) => {
  const u = req.user;
  const a = u.addresses.id(req.params.id);
  if (!a) throw new HttpError(404, 'Address not found');
  const wasDefault = a.isDefault;
  a.deleteOne();
  if (wasDefault && u.addresses.length) u.addresses[0].isDefault = true;
  await u.save();
  res.json(u.addresses);
}));

export default r;
