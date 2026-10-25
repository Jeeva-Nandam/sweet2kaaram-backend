import { Router } from 'express';
import { z } from 'zod';
import { ORDER_STATUSES, Order } from '../../models/Order';
import { releaseStock } from '../../services/pricing';
import { HttpError, ah, escapeRegex, objectId, paging, parse } from '../../utils/http';
import { httpsUrl } from './products';

const r = Router();

r.get('/', ah(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 20, 100);
  const f: Record<string, any> = {};
  const st = String(req.query.status ?? '');
  if ((ORDER_STATUSES as readonly string[]).includes(st)) f.status = st;
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 60)), 'i');
    f.$or = [{ orderNumber: rx }, { customerName: rx }, { customerPhone: rx }, { customerEmail: rx }];
  }
  const [items, total] = await Promise.all([
    Order.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(f),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

r.get('/:id', ah(async (req, res) => {
  const o = await Order.findById(objectId(req.params.id, 'Order'));
  if (!o) throw new HttpError(404, 'Order not found');
  res.json(o);
}));

const patch = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  note: z.string().trim().max(200).optional(),
  courier: z.string().trim().max(60).optional(),
  trackingNumber: z.string().trim().max(60).optional(),
  trackingUrl: httpsUrl.optional(),
  estimatedDelivery: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.literal(''), z.null()]).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
});

/** One endpoint for status moves and tracking details; every status change is logged with a time. */
r.patch('/:id', ah(async (req, res) => {
  const d = parse(patch, req.body);
  const o = await Order.findById(objectId(req.params.id, 'Order'));
  if (!o) throw new HttpError(404, 'Order not found');

  if (d.courier !== undefined) o.set('tracking.courier', d.courier);
  if (d.trackingNumber !== undefined) o.set('tracking.trackingNumber', d.trackingNumber);
  if (d.trackingUrl !== undefined) o.set('tracking.trackingUrl', d.trackingUrl);
  if (d.estimatedDelivery !== undefined) o.set('tracking.estimatedDelivery', d.estimatedDelivery ? new Date(d.estimatedDelivery) : null);
  if (d.paymentStatus) o.paymentStatus = d.paymentStatus;

  if (d.status && d.status !== o.status) {
    if (o.status === 'DELIVERED' || o.status === 'CANCELLED') throw new HttpError(400, 'This order is already closed');
    if (d.status === 'PLACED') throw new HttpError(400, 'An order cannot go back to Placed');
    if (d.status !== 'CANCELLED' && ORDER_STATUSES.indexOf(d.status) < ORDER_STATUSES.indexOf(o.status as any)) {
      throw new HttpError(400, 'An order cannot move backwards');
    }
    if (d.status === 'SHIPPED' && !o.tracking?.courier) throw new HttpError(400, 'Enter the courier name before marking the order as shipped');
    if (d.status === 'CANCELLED' && !o.stockRestored) {
      await releaseStock(o.items as any);
      o.stockRestored = true;
    }
    if (d.status === 'DELIVERED' && o.paymentMethod === 'COD') o.paymentStatus = 'PAID'; // cash collected
    o.status = d.status;
    o.statusHistory.push({ status: d.status, note: d.note ?? '', at: new Date() } as any);
  } else if (d.note) {
    o.statusHistory.push({ status: o.status, note: d.note, at: new Date() } as any);
  }

  await o.save();
  res.json(o);
}));

r.delete('/:id', ah(async (req, res) => {
  const result = await Order.deleteOne({ _id: objectId(req.params.id, 'Order') });
  if (result.deletedCount === 0) throw new HttpError(404, 'Order not found');
  res.json({ deleted: true });
}));

export default r;
