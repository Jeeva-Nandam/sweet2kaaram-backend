import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth';
import products from './products';
import categories from './categories';
import coupons from './coupons';
import orders from './orders';
import customers from './customers';
import stats from './stats';
import settings from './settings';

const r = Router();
r.use(requireAdmin); // every admin route below needs a valid admin token

r.get('/ping', (req, res) => res.json({ ok: true, admin: req.auth?.email }));
r.use('/stats', stats);
r.use('/products', products);
r.use('/categories', categories);
r.use('/coupons', coupons);
r.use('/orders', orders);
r.use('/customers', customers);
r.use('/settings', settings);

export default r;
