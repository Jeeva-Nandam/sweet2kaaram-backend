import { Schema, model } from 'mongoose';

const settingSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true },
    storeName: { type: String, default: 'Sweet2Kaaram' },
    tagline: { type: String, default: 'The Soul of Native Taste' },
    announcement: { type: String, default: '' }, // shown in the top ribbon
    isAcceptingOrders: { type: Boolean, default: true },
    pausedMessage: { type: String, default: 'We are not taking new orders right now. Please check back soon.' },
    codEnabled: { type: Boolean, default: true },
    onlinePaymentEnabled: { type: Boolean, default: false }, // flip on when a gateway is connected
    contactPhone: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    address: { type: String, default: '' },
    heroImage: { type: String, default: '' },
    heroTitle: { type: String, default: 'Authentic flavours, made the traditional way' },
    heroSubtitle: { type: String, default: 'Small-batch sweets, savouries, pickles and millet foods from regional kitchens.' },
  },
  { timestamps: true }
);

export const Setting = model('Setting', settingSchema);

const PUBLIC_FIELDS = [
  'storeName', 'tagline', 'announcement', 'isAcceptingOrders', 'pausedMessage',
  'codEnabled', 'onlinePaymentEnabled',
  'contactPhone', 'contactEmail', 'whatsapp', 'address', 'heroImage', 'heroTitle', 'heroSubtitle',
] as const;

export async function getSettings() {
  const settings = await Setting.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { upsert: true, new: true }
  );
  let changed = false;
  if (settings.storeName === 'Miras Heritage Foods') {
    settings.storeName = 'Sweet2Kaaram';
    changed = true;
  }
  if (settings.tagline === 'Authentic regional Indian delicacies') {
    settings.tagline = 'The Soul of Native Taste';
    changed = true;
  }
  if (changed) await settings.save();
  return settings;
}

export function publicSettings(s: any) {
  const out: Record<string, unknown> = {};
  for (const f of PUBLIC_FIELDS) out[f] = s[f];
  return out;
}
