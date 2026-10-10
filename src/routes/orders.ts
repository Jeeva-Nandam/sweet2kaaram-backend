import { Router } from 'express';
import { z } from 'zod';
import { requireCustomer } from '../middleware/auth';
import { Order, nextOrderNumber } from '../models/Order';
import { Coupon } from '../models/Coupon';
import { buildQuote, releaseStock, reserveStock } from '../services/pricing';
import { HttpError, ah, objectId, parse } from '../utils/http';

const r = Router();

const itemsSchema = z
  .array(z.object({ productId: z.string(), quantity: z.coerce.number().int().min(1).max(20) }))
  .min(1, 'Your cart is empty')
  .max(40);

const quoteView = (q: Awaited<ReturnType<typeof buildQuote>>) => ({
  lines: q.lines.map((l) => ({
    productId: String(l.product._id), name: l.product.name, weight: l.product.weight, image: l.product.image,
    price: l.product.price, stock: l.product.stock, quantity: l.quantity,
  })),
  subtotal: q.subtotal,
  discount: q.discount,
  shippingFee: q.shippingFee,
  total: q.total,
  couponCode: q.coupon?.code ?? '',
  couponError: q.couponError,
  problems: q.problems,
});

/** Public: lets the cart and checkout show trusted totals and test a coupon. */
r.post('/quote', ah(async (req, res) => {
  const body = parse(z.object({ items: itemsSchema, couponCode: z.string().trim().max(24).optional() }), req.body);
  res.json(quoteView(await buildQuote(body)));
}));

r.use(requireCustomer);

r.post('/', ah(async (req, res) => {
  const body = parse(
    z.object({
      items: itemsSchema,
      addressId: z.string(),
      paymentMethod: z.enum(['COD', 'ONLINE']).default('COD'),
      couponCode: z.string().trim().max(24).optional(),
      customerNote: z.string().trim().max(300).default(''),
    }),
    req.body
  );
  const user = req.user;
  const address = user.addresses.id(body.addressId);
  if (!address) throw new HttpError(400, 'Please choose a delivery address');

  const q = await buildQuote(body);
  if (!q.settings.isAcceptingOrders) throw new HttpError(503, q.settings.pausedMessage);
  if (body.paymentMethod === 'COD' && !q.settings.codEnabled) throw new HttpError(400, 'Cash on delivery is not available right now');
  if (body.paymentMethod === 'ONLINE' && !q.settings.onlinePaymentEnabled) throw new HttpError(400, 'Online payment is not available yet');
  if (q.problems.length) throw new HttpError(409, q.problems[0]);
  if (body.couponCode && q.couponError) throw new HttpError(400, q.couponError);

  await reserveStock(q.lines);
  const items = q.lines.map((l) => ({
    product: l.product._id, name: l.product.name, weight: l.product.weight,
    image: l.product.image, price: l.product.price, quantity: l.quantity,
  }));

  try {
    if (q.coupon) {
      const ok = await Coupon.updateOne(
        { _id: q.coupon._id, isActive: true, $or: [{ usageLimit: 0 }, { $expr: { $lt: ['$timesUsed', '$usageLimit'] } }] },
        { $inc: { timesUsed: 1 } }
      );
      if (ok.modifiedCount !== 1) throw new HttpError(409, 'This coupon has just been fully redeemed');
    }
    const order = await Order.create({
      orderNumber: await nextOrderNumber(),
      user: user._id,
      customerName: address.name,
      customerEmail: user.email,
      customerPhone: address.phone,
      address: address.toObject(),
      items,
      subtotal: q.subtotal,
      discount: q.discount,
      couponCode: q.coupon?.code ?? '',
      shippingFee: q.shippingFee,
      total: q.total,
      paymentMethod: body.paymentMethod,
      customerNote: body.customerNote,
      statusHistory: [{ status: 'PLACED', note: 'Order placed' }],
    });
    res.status(201).json(order);
  } catch (e) {
    await releaseStock(items);
    throw e;
  }
}));

r.get('/mine', ah(async (req, res) => {
  res.json(await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100));
}));

r.get('/mine/:id', ah(async (req, res) => {
  const o = await Order.findOne({ _id: objectId(req.params.id, 'Order'), user: req.user._id });
  if (!o) throw new HttpError(404, 'Order not found');
  res.json(o);
}));

r.get('/track/:orderNumber', ah(async (req, res) => {
  const o = await Order.findOne({ orderNumber: req.params.orderNumber.trim().toUpperCase(), user: req.user._id });
  if (!o) throw new HttpError(404, 'We could not find that order on your account');
  res.json(o);
}));

r.post('/mine/:id/cancel', ah(async (req, res) => {
  const o = await Order.findOneAndUpdate(
    { _id: objectId(req.params.id, 'Order'), user: req.user._id, status: { $in: ['PLACED', 'CONFIRMED'] }, stockRestored: false },
    {
      $set: { status: 'CANCELLED', stockRestored: true },
      $push: { statusHistory: { status: 'CANCELLED', note: 'Cancelled by customer', at: new Date() } },
    },
    { new: true }
  );
  if (!o) throw new HttpError(400, 'This order can no longer be cancelled. It may already be preparing or shipped');
  await releaseStock(o.items as any);
  res.json(o);
}));

export default r;
