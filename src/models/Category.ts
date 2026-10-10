import { Schema, model } from 'mongoose';
import { cleanJson } from './_plugin';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '', maxlength: 300 },
    icon: { type: String, default: 'restaurant' }, // Material Symbols icon name
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
cleanJson(categorySchema);
export const Category = model('Category', categorySchema);
