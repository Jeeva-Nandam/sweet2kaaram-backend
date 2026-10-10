import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { connectDB } from './config/db';
import { errorHandler, notFound } from './middleware/error';
import { ah } from './utils/http';
import auth from './routes/auth';
import catalog from './routes/catalog';
import me from './routes/me';
import orders from './routes/orders';
import admin from './routes/admin';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // No Origin header = server-to-server / curl; browsers always send one.
      if (!origin || env.frontendUrls.includes(origin.replace(/\/$/, ''))) return cb(null, true);
      cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);
app.use(express.json({ limit: '100kb' }));

const health = (_req: express.Request, res: express.Response) => res.json({ ok: true, service: 'miras-heritage-api' });
app.get('/', health);
app.get('/api', health);
app.get('/api/health', health);

const general = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests. Please slow down' } });
const strict = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many login attempts. Try again in a few minutes' } });
app.use('/api', general);
app.use('/api/auth', strict);

app.use('/api', ah(async (_req, _res, next) => { await connectDB(); next(); }));

app.use('/api/auth', auth);
app.use('/api/me', me);
app.use('/api/orders', orders);
app.use('/api/admin', admin);
app.use('/api', catalog);

app.use(notFound);
app.use(errorHandler);

export default app;
