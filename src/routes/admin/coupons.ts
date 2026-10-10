import { Router } from 'express';
import { z } from 'zod';
import { Coupon } from '../../models/Coupon';
import { HttpError, ah, objectId, parse } from '../../utils/http';

const r = Router();

const input = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/, 'Code: 3-24 letters, numbers, - or _'),
    description: z.string().trim().max(160).default(''),
    type: z.enum(['PERCENT', 'FLAT']),
    value: z.coerce.number().min(1),
    maxDiscount: z.coerce.number().min(0).default(0),
    minOrder: z.coerce.number().min(0).default(0),
    expiresAt: z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()]).optional(),
    usageLimit: z.coerce.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.type !== 'PERCENT' || d.value <= 100, { message: 'Percentage cannot be more than 100', path: ['value'] });

const normalise = (d: any) => ({ ...d, expiresAt: d.expiresAt ? new Date(d.expiresAt) : null });

r.get('/', ah(async (_req, res) => res.json(await Coupon.find().sort({ createdAt: -1 }))));

r.post('/', ah(async (req, res) => {
  res.status(201).json(await Coupon.create(normalise(parse(input, req.body))));
}));

r.put('/:id', ah(async (req, res) => {
  const d = normalise(parse(input, req.body));
  const c = await Coupon.findByIdAndUpdate(objectId(req.params.id, 'Coupon'), { $set: d }, { new: true, runValidators: true });
  if (!c) throw new HttpError(404, 'Coupon not found');
  res.json(c);
}));

r.delete('/:id', ah(async (req, res) => {
  const c = await Coupon.findByIdAndDelete(objectId(req.params.id, 'Coupon'));
  if (!c) throw new HttpError(404, 'Coupon not found');
  res.json({ ok: true });
}));

export default r;
