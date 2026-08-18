# Solve Roofing Payments

Standalone Stripe checkout for Solve Roofing deposits.

## Vercel

Import this repo as a new Vercel project. Add these Production environment variables:

| Variable | Notes |
| --- | --- |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_…` or `pk_test_…` |
| `STRIPE_SECRET_KEY` | `sk_live_…` or `sk_test_…` |
| `STRIPE_PRICE_ID` | Deposit price from Stripe |
| `STRIPE_PRODUCT_ID` | Optional; must match the price’s product |
| `MAKE_WEBHOOK_URL` | Make.com webhook for successful deposits |

The `ROOFING_STRIPE_*` and `ROOFING_MAKE_WEBHOOK_URL` names from the old Energy project still work if you copy them as-is.

## Local

```bash
npm install
```

Deploy with Vercel. The payment page is `solve_roofing_payment_link.html` (`/` redirects there).
