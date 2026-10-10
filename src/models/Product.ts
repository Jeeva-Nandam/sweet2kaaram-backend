import { Schema, model } from 'mongoose';
import { cleanJson } from './_plugin';

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nativeTitle: { type: String, default: '', trim: true, maxlength: 120 },
    category: { type: String, required: true, index: true }, // category slug
    origin: { type: String, default: '', trim: true, maxlength: 80 },
    weight: { type: String, required: true, trim: true, maxlength: 40 },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, default: 0, min: 0 }, // MRP, 0 = none
    description: { type: String, default: '', maxlength: 2000 },
    ingredients: { type: [String], default: [] },
    shelfLife: { type: String, default: '', maxlength: 60 },
    image: { type: String, default: '' },
    badge: { type: String, default: '', maxlength: 30 },
    isVeg: { type: Boolean, default: true },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },
    isActive: { type: Boolean, default: true },
    isTopSeller: { type: Boolean, default: false },
  },
  { timestamps: true }
);
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.virtual('inStock').get(function (this: any) {
  return this.stock > 0;
});
cleanJson(productSchema);
export const Product = model('Product', productSchema);
