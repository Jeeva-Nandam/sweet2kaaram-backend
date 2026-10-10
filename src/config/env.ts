import 'dotenv/config';

const get = (k: string, fallback = '') => (process.env[k] ?? fallback).trim();

export const env = {
  isProd: get('NODE_ENV') === 'production' || !!process.env.VERCEL,
  port: Number(get('PORT', '4000')),
  mongoUri: get('MONGODB_URI'),
  jwtSecret: get('JWT_SECRET'),
  googleClientId: get('GOOGLE_CLIENT_ID'),
  adminEmail: get('ADMIN_EMAIL').toLowerCase(),
  adminPasswordHash: get('ADMIN_PASSWORD_HASH'),
  frontendUrls: get('FRONTEND_URL')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  cloudinary: {
    cloudName: get('CLOUDINARY_CLOUD_NAME'),
    apiKey: get('CLOUDINARY_API_KEY'),
    apiSecret: get('CLOUDINARY_API_SECRET'),
  },
};
