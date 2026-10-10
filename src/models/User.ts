import { Schema, model } from 'mongoose';
import { cleanJson } from './_plugin';

export const addressSchema = new Schema(
  {
    label: { type: String, default: 'Home', trim: true, maxlength: 30 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    landmark: { type: String, default: '', trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 60 },
    pincode: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: false }
);
cleanJson(addressSchema);

const userSchema = new Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    picture: { type: String, default: '' },
    phone: { type: String, default: '' },
    addresses: { type: [addressSchema], default: [] },
    lastLoginAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
cleanJson(userSchema);

export const User = model('User', userSchema);
