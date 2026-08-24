import Stripe from 'stripe';
import { cardDetailsFromBody, cardDetailsFromPaymentIntent, paymentMethodIdFromBody } from '../lib/stripe-card.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookUrl = (
    process.env.MAKE_WEBHOOK_URL ||
    process.env.ROOFING_MAKE_WEBHOOK_URL ||
    ''
  ).trim();

  if (!webhookUrl) {
    return res.status(500).json({ error: 'MAKE_WEBHOOK_URL is not configured' });
  }

  const body = req.body || {};
  const paymentId = typeof body.payment_id === 'string' ? body.payment_id.trim() : '';
  const isError = body.status === 'error' || body.status === 'failed';
  const isSuccess = body.status === 'succeeded';

  if (!isSuccess && !isError) {
    return res.status(400).json({ error: 'A payment status of succeeded or error is required' });
  }
  if (isSuccess && !paymentId) {
    return res.status(400).json({ error: 'Successful payment_id is required' });
  }

  const amount = Number.isFinite(Number(body.amount)) ? Number(body.amount) : 1031;
  const client = {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    email: typeof body.email === 'string' ? body.email.trim() : '',
    phone: typeof body.phone === 'string' ? body.phone.trim() : '',
    address: typeof body.address === 'string' ? body.address.trim() : '',
    city: typeof body.city === 'string' ? body.city.trim() : '',
    state: typeof body.state === 'string' ? body.state.trim() : '',
    postal_code: typeof body.postal_code === 'string' ? body.postal_code.trim() : '',
    amount,
    currency: 'cad',
    division: 'roofing',
  };

  if (isError) {
    const payload = {
      ...client,
      payment_id: paymentId,
      status: 'error',
      payment_status: 'error',
      error_message: typeof body.error_message === 'string' ? body.error_message.trim() : '',
      error_type: typeof body.error_type === 'string' ? body.error_type.trim() : '',
      error_code: typeof body.error_code === 'string' ? body.error_code.trim() : '',
      payment_method: typeof body.payment_method === 'string' ? body.payment_method.trim() : '',
      card_brand: typeof body.card_brand === 'string' ? body.card_brand.trim() : '',
      card_last4: typeof body.card_last4 === 'string' ? body.card_last4.trim() : '',
    };

    try {
      const makeRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!makeRes.ok) {
        const text = await makeRes.text();
        console.error('Roofing Make error webhook failed:', makeRes.status, text);
        return res.status(502).json({ error: 'Failed to send payment webhook' });
      }

      return res.status(200).json({ ok: true, status: 'error' });
    } catch (e) {
      console.error('notify-payment error:', e);
      return res.status(500).json({ error: e.message || 'Failed to send payment webhook' });
    }
  }

  let card = cardDetailsFromBody(body);
  const secretKey = process.env.STRIPE_SECRET_KEY || process.env.ROOFING_STRIPE_SECRET_KEY;
  if ((!card.card_brand || !card.card_last4) && secretKey) {
    const stripe = new Stripe(secretKey);
    const fromStripe = await cardDetailsFromPaymentIntent(
      stripe,
      paymentId,
      paymentMethodIdFromBody(body),
    );
    if (fromStripe.card_brand && fromStripe.card_last4) {
      card = fromStripe;
    }
  } else if (!card.card_brand || !card.card_last4) {
    console.error('STRIPE_SECRET_KEY is not configured; cannot load card brand/last4');
  }

  const payload = {
    ...client,
    payment_id: paymentId,
    card_brand: card.card_brand,
    card_last4: card.card_last4,
    payment_method: card.payment_method,
    status: 'succeeded',
    payment_status: 'succeeded',
  };

  try {
    const makeRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!makeRes.ok) {
      const text = await makeRes.text();
      console.error('Make webhook failed:', makeRes.status, text);
      return res.status(502).json({ error: 'Failed to send payment webhook' });
    }

    return res.status(200).json({ ok: true, card_brand: card.card_brand, card_last4: card.card_last4 });
  } catch (e) {
    console.error('notify-payment error:', e);
    return res.status(500).json({ error: e.message || 'Failed to send payment webhook' });
  }
}
