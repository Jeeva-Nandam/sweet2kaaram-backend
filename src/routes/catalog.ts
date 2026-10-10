import { Router } from 'express';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { getSettings, publicSettings } from '../models/Setting';
import { ah, escapeRegex, objectId, paging, HttpError } from '../utils/http';

const r = Router();

r.get('/settings', ah(async (_req, res) => {
  res.json(publicSettings(await getSettings()));
}));

r.get('/categories', ah(async (_req, res) => {
  const [cats, counts] = await Promise.all([
    Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }),
    Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$category', n: { $sum: 1 } } }]),
  ]);
  const map = new Map(counts.map((c: any) => [c._id, c.n]));
  res.json(cats.map((c) => ({ ...c.toJSON(), itemCount: map.get(c.slug) ?? 0 })));
}));

const SORTS: Record<string, any> = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { isTopSeller: -1, createdAt: -1 },
};

r.get('/products', ah(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 24, 60);
  const filter: Record<string, any> = { isActive: true };
  if (typeof req.query.category === 'string' && req.query.category) filter.category = req.query.category;
  if (req.query.featured === '1') filter.isTopSeller = true;
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 60)), 'i');
    filter.$or = [{ name: rx }, { nativeTitle: rx }, { origin: rx }, { description: rx }];
  }
  const sort = SORTS[String(req.query.sort)] ?? SORTS.popular;
  const [items, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

r.get('/products/:id', ah(async (req, res) => {
  const p = await Product.findOne({ _id: objectId(req.params.id, 'Product'), isActive: true });
  if (!p) throw new HttpError(404, 'Product not found');
  res.json(p);
}));

export default r;
