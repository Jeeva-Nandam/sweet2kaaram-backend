import { Router } from 'express';
import { z } from 'zod';
import { Category } from '../../models/Category';
import { Product } from '../../models/Product';
import { HttpError, ah, objectId, parse, slugify } from '../../utils/http';

const r = Router();

const input = z.object({
  name: z.string().trim().min(2, 'Enter a category name').max(60),
  description: z.string().trim().max(300).default(''),
  icon: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, 'Use a Material Symbols icon name, e.g. cookie').default('restaurant'),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

r.get('/', ah(async (_req, res) => {
  const [cats, counts] = await Promise.all([
    Category.find().sort({ sortOrder: 1, name: 1 }),
    Product.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]),
  ]);
  const map = new Map(counts.map((c: any) => [c._id, c.n]));
  res.json(cats.map((c) => ({ ...c.toJSON(), itemCount: map.get(c.slug) ?? 0 })));
}));

r.post('/', ah(async (req, res) => {
  const d = parse(input, req.body);
  const slug = slugify(d.name);
  if (!slug) throw new HttpError(400, 'Enter a valid category name');
  res.status(201).json(await Category.create({ ...d, slug }));
}));

// The slug never changes after creation, so product links and filters stay valid.
r.put('/:id', ah(async (req, res) => {
  const d = parse(input.partial(), req.body);
  const c = await Category.findByIdAndUpdate(objectId(req.params.id, 'Category'), { $set: d }, { new: true, runValidators: true });
  if (!c) throw new HttpError(404, 'Category not found');
  res.json(c);
}));

r.delete('/:id', ah(async (req, res) => {
  const c = await Category.findById(objectId(req.params.id, 'Category'));
  if (!c) throw new HttpError(404, 'Category not found');
  const n = await Product.countDocuments({ category: c.slug });
  if (n > 0) throw new HttpError(409, `This category still has ${n} product${n > 1 ? 's' : ''}. Move or delete them first`);
  await c.deleteOne();
  res.json({ ok: true });
}));

export default r;
