import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { HttpError } from '../utils/http';

const API_URL = 'https://api.razorpay.com/v1';

export function isRazorpayConfigured() {
  return /^rzp_(test|live)_[A-Za-z0-9]+$/.test(env.razorpay.keyId)
    && env.razorpay.keySecret.length > 0;
}

function authorization() {
  if (!isRazorpayConfigured()) {
    throw new HttpError(503, 'Online payments are not configured yet. Add the Razorpay key ID and secret to the backend environment');
  }
  return `Basic ${Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString('base64')}`;
}

async function razorpayRequest<T>(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: authorization(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new HttpError(502, 'Could not connect to Razorpay. Please try again');
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(401, 'Razorpay authentication failed. Check the backend payment credentials');
    }
    throw new HttpError(500, 'Razorpay could not process the payment request. Please try again');
  }
  return (await response.json()) as T;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
}

export function createRazorpayOrder(amount: number, receipt: string) {
  if (!Number.isSafeInteger(amount) || amount < 100) {
    throw new HttpError(400, 'Online payments must be at least ₹1.00');
  }
  return razorpayRequest<RazorpayOrder>('/orders', 'POST', {
    amount,
    currency: 'INR',
    receipt,
  });
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  if (!/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string) {
  if (!env.razorpay.webhookSecret || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', env.razorpay.webhookSecret).update(rawBody).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function confirmRazorpayPayment(paymentId: string, expectedOrderId: string, expectedAmount: number) {
  const payment = await razorpayRequest<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`, 'GET');
  if (payment.order_id !== expectedOrderId || payment.amount !== expectedAmount || payment.currency !== 'INR') {
    throw new HttpError(400, 'The payment details do not match this order');
  }

  if (payment.status === 'authorized') {
    const captured = await razorpayRequest<RazorpayPayment>(
      `/payments/${encodeURIComponent(paymentId)}/capture`,
      'POST',
      { amount: expectedAmount, currency: 'INR' }
    );
    if (captured.status === 'captured') return captured;
  } else if (payment.status === 'captured') {
    return payment;
  }

  throw new HttpError(400, 'Razorpay has not captured this payment');
}
