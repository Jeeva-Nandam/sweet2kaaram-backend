import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { env } from '../../config/env';
import { Setting, getSettings } from '../../models/Setting';
import { HttpError, ah, parse } from '../../utils/http';
import { httpsUrl } from './products';

const r = Router();

r.get('/', ah(async (_req, res) => res.json(await getSettings())));

const input = z
  .object({
    storeName: z.string().trim().min(2).max(60),
    tagline: z.string().trim().max(120),
    announcement: z.string().trim().max(200),
    isAcceptingOrders: z.boolean(),
    pausedMessage: z.string().trim().max(200),
    codEnabled: z.boolean(),
    onlinePaymentEnabled: z.boolean(),
    contactPhone: z.string().trim().max(20),
    contactEmail: z.string().trim().max(80),
    whatsapp: z.string().trim().max(20),
    address: z.string().trim().max(300),
    heroImage: httpsUrl,
    heroTitle: z.string().trim().max(100),
    heroSubtitle: z.string().trim().max(200),
  })
  .partial();

r.put('/', ah(async (req, res) => {
  const d = parse(input, req.body);
  res.json(await Setting.findOneAndUpdate({ key: 'main' }, { $set: d }, { upsert: true, new: true }));
}));

/** Signed parameters so the browser can upload straight to Cloudinary (no file passes through Vercel). */
r.post('/upload-signature', ah(async (req, res) => {
  const c = env.cloudinary;
  if (!c.cloudName || !c.apiKey || !c.apiSecret) {
    throw new HttpError(501, 'Image upload is not set up yet. Paste an image link instead, or add the Cloudinary keys');
  }
  const { kind } = parse(z.object({ kind: z.enum(['product', 'hero']).default('product') }), req.body);
  const folder = `sweet2kaaram/${kind}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${c.apiSecret}`).digest('hex');
  res.json({ cloudName: c.cloudName, apiKey: c.apiKey, folder, timestamp, signature });
}));

export default r;
