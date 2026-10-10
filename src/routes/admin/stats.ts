import { Router } from 'express';
import { Order } from '../../models/Order';
import { Product } from '../../models/Product';
import { User } from '../../models/User';
import { ah } from '../../utils/http';

const r = Router();
const TZ = 'Asia/Kolkata';
const istDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

r.get('/', ah(async (_req, res) => {
  const now = new Date();
  const since = new Date(now.getTime() - 8 * 86400000);
  const live = { $ne: 'CANCELLED' };

  const [totals, daily, byStatus, recent, lowStock, top, customers, products] = await Promise.all([
    Order.aggregate([{ $match: { status: live } }, { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: live } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.find().sort({ createdAt: -1 }).limit(8),
    Product.find({ isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).sort({ stock: 1 }).limit(8),
    Order.aggregate([
      { $match: { status: live } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', name: { $first: '$items.name' }, image: { $first: '$items.image' }, sold: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { sold: -1 } },
      { $limit: 5 },
    ]),
    User.countDocuments(),
    Product.countDocuments(),
  ]);

  const dmap = new Map(daily.map((d: any) => [d._id, d]));
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const key = istDate(new Date(now.getTime() - (6 - i) * 86400000));
    const d: any = dmap.get(key);
    return { date: key, orders: d?.orders ?? 0, revenue: d?.revenue ?? 0 };
  });
  const today = last7[6];
  const counts = Object.fromEntries(byStatus.map((s: any) => [s._id, s.n]));

  res.json({
    revenue: totals[0]?.revenue ?? 0,
    orders: totals[0]?.orders ?? 0,
    todayOrders: today.orders,
    todayRevenue: today.revenue,
    pending: (counts.PLACED ?? 0) + (counts.CONFIRMED ?? 0) + (counts.PREPARING ?? 0),
    inTransit: (counts.SHIPPED ?? 0) + (counts.OUT_FOR_DELIVERY ?? 0),
    statusCounts: counts,
    customers,
    products,
    outOfStock: await Product.countDocuments({ stock: 0 }),
    last7,
    recentOrders: recent,
    lowStock,
    topProducts: top.map((t: any) => ({ id: String(t._id), name: t.name, image: t.image, sold: t.sold, revenue: t.revenue })),
  });
}));

export default r;
