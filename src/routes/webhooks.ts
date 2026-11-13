import { Router, Request } from 'express';
import { Order } from '../models/Order';
import { verifyRazorpayWebhookSignature } from '../services/razorpay';
import { HttpError, ah } from '../utils/http';

const r = Router();

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

r.post('/', ah(async (req, res) => {
  const rawBody = (req as RawBodyRequest).rawBody;
  const signature = req.header('x-razorpay-signature') ?? '';
  if (!rawBody || !verifyRazorpayWebhookSignature(rawBody, signature)) {
    throw new HttpError(400, 'Invalid Razorpay webhook signature');
  }

  const event = req.body as {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string } } };
  };
  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id || payment.status !== 'captured' || payment.currency !== 'INR') {
      throw new HttpError(400, 'Invalid Razorpay payment event');
    }

    const order = await Order.findOne({ razorpayOrderId: payment.order_id, paymentMethod: 'ONLINE' });
    if (order && payment.amount === Math.round(order.total * 100)) {
      if (order.paymentStatus === 'PAID' && order.razorpayPaymentId === payment.id) {
        res.json({ received: true });
        return;
      }
      await Order.updateOne(
        { _id: order._id, paymentStatus: 'PENDING', status: { $ne: 'CANCELLED' } },
        { $set: { paymentStatus: 'PAID', razorpayPaymentId: payment.id } }
      );
    }
  }

  res.json({ received: true });
}));

export default r;
