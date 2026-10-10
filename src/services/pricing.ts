import { Types } from 'mongoose';
import { Product } from '../models/Product';
import { Coupon } from '../models/Coupon';
import { getSettings } from '../models/Setting';
import { HttpError } from '../utils/http';

export interface QuoteInput {
  items: { productId: string; quantity: number }[];
  couponCode?: string;
}

/**
 * The server is the only source of truth for prices, stock and discounts.
 * Whatever the browser sends is limited to product ids, quantities and a coupon code.
 */
export async function buildQuote({ items, couponCode }: QuoteInput) {
  const wanted = new Map<string, number>();
  for (const it of items) wanted.set(it.productId, Math.min(20, (wanted.get(it.productId) ?? 0) + it.quantity));

  const ids = [...wanted.keys()].filter((id) => Types.ObjectId.isValid(id));
  const products = ids.length ? await Product.find({ _id: { $in: ids } }) : [];

  const lines: { product: any; quantity: number }[] = [];
  const problems: string[] = [];
  for (const [id, quantity] of wanted) {
    const p = products.find((x) => String(x._id) === id);
    if (!p || !p.isActive) {
      problems.push('An item in your cart is no longer available');
      continue;
    }
    if (p.stock < quantity) {
      problems.push(p.stock === 0 ? `${p.name} is out of stock` : `${p.name}: only ${p.stock} left`);
    }
    lines.push({ product: p, quantity });
  }

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  const settings = await getSettings();
  const shippingFee = subtotal === 0 || subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;

  let discount = 0;
  let coupon: any = null;
  let couponError = '';
  const code = couponCode?.trim().toUpperCase();
  if (code) {
    coupon = await Coupon.findOne({ code });
    if (!coupon || !coupon.isActive) couponError = 'This coupon code is not valid';
    else if (coupon.expiresAt && coupon.expiresAt < new Date()) couponError = 'This coupon has expired';
    else if (coupon.usageLimit > 0 && coupon.timesUsed >= coupon.usageLimit) couponError = 'This coupon is fully redeemed';
    else if (subtotal < coupon.minOrder) couponError = `Add items worth ₹${coupon.minOrder - subtotal} more to use this coupon`;
    if (couponError) coupon = null;
    else {
      discount = coupon.type === 'PERCENT' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
      if (coupon.type === 'PERCENT' && coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
      discount = Math.min(discount, subtotal);
    }
  }

  return {
    lines, problems, coupon, couponError, subtotal, discount, shippingFee,
    total: subtotal - discount + shippingFee,
    settings,
  };
}

/** Atomically take stock; if any line fails, everything taken so far is returned. */
export async function reserveStock(lines: { product: any; quantity: number }[]) {
  const taken: typeof lines = [];
  try {
    for (const l of lines) {
      const r = await Product.updateOne(
        { _id: l.product._id, isActive: true, stock: { $gte: l.quantity } },
        { $inc: { stock: -l.quantity } }
      );
      if (r.modifiedCount !== 1) throw new HttpError(409, `${l.product.name} just went out of stock. Please update your cart`);
      taken.push(l);
    }
  } catch (e) {
    await releaseStock(taken.map((l) => ({ product: l.product._id, quantity: l.quantity })));
    throw e;
  }
}

export async function releaseStock(items: { product: any; quantity: number }[]) {
  await Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } })));
}
