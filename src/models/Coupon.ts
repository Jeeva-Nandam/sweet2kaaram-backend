import { Schema, model } from 'mongoose';
import { cleanJson } from './_plugin';

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 24 },
    description: { type: String, default: '', maxlength: 160 },
    type: { type: String, enum: ['PERCENT', 'FLAT'], required: true },
    value: { type: Number, required: true, min: 1 },
    maxDiscount: { type: Number, default: 0, min: 0 }, // cap for PERCENT, 0 = no cap
    minOrder: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    timesUsed: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
cleanJson(couponSchema);
export const Coupon = model('Coupon', couponSchema);
