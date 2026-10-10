import { Schema, model } from 'mongoose';
import { cleanJson } from './_plugin';

export const ORDER_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const itemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    weight: String,
    image: String,
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const historySchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    address: {
      label: String, name: String, phone: String, line1: String,
      landmark: String, city: String, state: String, pincode: String,
    },
    items: { type: [itemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: '' },
    shippingFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['COD', 'ONLINE'], default: 'COD' },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' },
    status: { type: String, enum: ORDER_STATUSES, default: 'PLACED', index: true },
    statusHistory: { type: [historySchema], default: [] },
    tracking: {
      courier: { type: String, default: '' },
      trackingNumber: { type: String, default: '' },
      trackingUrl: { type: String, default: '' },
      estimatedDelivery: { type: Date, default: null },
    },
    customerNote: { type: String, default: '', maxlength: 300 },
    stockRestored: { type: Boolean, default: false },
  },
  { timestamps: true }
);
orderSchema.index({ createdAt: -1 });
cleanJson(orderSchema);
export const Order = model('Order', orderSchema);

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = model('Counter', counterSchema);

/** Atomic, race-free order numbers: MH1001, MH1002, ... */
export async function nextOrderNumber() {
  const c = await Counter.findOneAndUpdate({ _id: 'order' }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `MH${1000 + (c as any).seq}`;
}
