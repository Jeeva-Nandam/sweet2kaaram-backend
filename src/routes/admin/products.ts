import { Router } from 'express';
import { z } from 'zod';
import { Product } from '../../models/Product';
import { Category } from '../../models/Category';
import { HttpError, ah, escapeRegex, objectId, paging, parse } from '../../utils/http';

const r = Router();

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\/[^\s]+$/i.test(v), 'Image link must start with https://');

const productInput = z.object({
  name: z.string().trim().min(2, 'Enter the product name').max(120),
  nativeTitle: z.string().trim().max(120).default(''),
  category: z.string().trim().min(1, 'Choose a category'),
  origin: z.string().trim().max(80).default(''),
  weight: z.string().trim().min(1, 'Enter the pack weight, e.g. 500 g').max(40),
  price: z.coerce.number().min(1, 'Enter the selling price'),
  originalPrice: z.coerce.number().min(0).default(0),
  description: z.string().trim().max(2000).default(''),
  ingredients: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  shelfLife: z.string().trim().max(60).default(''),
  image: httpsUrl.default(''),
  badge: z.string().trim().max(30).default(''),
  isVeg: z.boolean().default(true),
  stock: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
  isActive: z.boolean().default(true),
  isTopSeller: z.boolean().default(false),
});

async function checkRefs(d: Partial<z.infer<typeof productInput>>) {
  if (d.category && !(await Category.exists({ slug: d.category }))) throw new HttpError(400, 'That category does not exist. Create it first');
  if (d.originalPrice && d.price && d.originalPrice < d.price) throw new HttpError(400, 'MRP must be higher than the selling price (or leave it 0)');
}

r.get('/', ah(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 20, 100);
  const f: Record<string, any> = {};
  if (typeof req.query.category === 'string' && req.query.category) f.category = req.query.category;
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 60)), 'i');
    f.$or = [{ name: rx }, { nativeTitle: rx }];
  }
  const s = req.query.state;
  if (s === 'active') f.isActive = true;
  if (s === 'hidden') f.isActive = false;
  if (s === 'out') f.stock = 0;
  if (s === 'low') f.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] };
  const [items, total] = await Promise.all([
    Product.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(f),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

r.get('/:id', ah(async (req, res) => {
  const p = await Product.findById(objectId(req.params.id, 'Product'));
  if (!p) throw new HttpError(404, 'Product not found');
  res.json(p);
}));

r.post('/', ah(async (req, res) => {
  const d = parse(productInput, req.body);
  await checkRefs(d);
  res.status(201).json(await Product.create(d));
}));

r.put('/:id', ah(async (req, res) => {
  const d = parse(productInput.partial(), req.body);
  await checkRefs(d);
  const p = await Product.findByIdAndUpdate(objectId(req.params.id, 'Product'), { $set: d }, { new: true, runValidators: true });
  if (!p) throw new HttpError(404, 'Product not found');
  res.json(p);
}));

r.patch('/:id/stock', ah(async (req, res) => {
  const { stock } = parse(z.object({ stock: z.coerce.number().int().min(0).max(1_000_000) }), req.body);
  const p = await Product.findByIdAndUpdate(objectId(req.params.id, 'Product'), { $set: { stock } }, { new: true });
  if (!p) throw new HttpError(404, 'Product not found');
  res.json(p);
}));

r.delete('/:id', ah(async (req, res) => {
  const p = await Product.findByIdAndDelete(objectId(req.params.id, 'Product'));
  if (!p) throw new HttpError(404, 'Product not found');
  res.json({ ok: true });
}));

export default r;
