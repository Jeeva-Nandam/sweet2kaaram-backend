import mongoose from 'mongoose';
import { env } from './env';
import { HttpError } from '../utils/http';

type Cache = { conn?: typeof mongoose; promise?: Promise<typeof mongoose> };
const g = globalThis as unknown as { __mongooseCache?: Cache };
const cache: Cache = (g.__mongooseCache ??= {});

/** Re-uses one connection across serverless invocations. */
export async function connectDB() {
  if (cache.conn) return cache.conn;
  if (!env.mongoUri) throw new HttpError(500, 'Server is not configured: MONGODB_URI is missing');
  mongoose.set('strictQuery', true);
  cache.promise ??= mongoose
    .connect(env.mongoUri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 })
    .catch((e) => {
      cache.promise = undefined;
      throw e;
    });
  cache.conn = await cache.promise;
  return cache.conn;
}
