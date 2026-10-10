import { Router } from 'express';
import { Order } from '../../models/Order';
import { User } from '../../models/User';
import { ah, escapeRegex } from '../../utils/http';

const r = Router();

r.get('/', ah(async (req, res) => {
  const f: Record<string, any> = {};
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 60)), 'i');
    f.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const users = await User.find(f).sort({ createdAt: -1 }).limit(300);
  const stats = await Order.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) } } },
    {
      $group: {
        _id: '$user',
        orders: { $sum: 1 },
        spent: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 0, '$total'] } },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
  ]);
  const map = new Map(stats.map((s: any) => [String(s._id), s]));
  res.json(
    users.map((u) => {
      const s: any = map.get(String(u._id));
      const a: any = u.addresses.find((x: any) => x.isDefault) ?? u.addresses[0];
      return {
        ...u.toJSON(),
        phone: u.phone || a?.phone || '',
        city: a?.city ?? '',
        orders: s?.orders ?? 0,
        spent: s?.spent ?? 0,
        lastOrderAt: s?.lastOrderAt ?? null,
      };
    })
  );
}));

export default r;
