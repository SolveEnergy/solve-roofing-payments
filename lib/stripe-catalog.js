export async function loadRoofingPrice(stripe) {
  const priceId = process.env.STRIPE_PRICE_ID || process.env.ROOFING_STRIPE_PRICE_ID;
  const expectedProductId = process.env.STRIPE_PRODUCT_ID || process.env.ROOFING_STRIPE_PRODUCT_ID || '';

  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID is not configured');
  }

  const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });

  if (price.unit_amount == null) {
    throw new Error('Stripe price must be a fixed one-time amount');
  }
  if (price.type && price.type !== 'one_time') {
    throw new Error('Stripe price must be a one-time price for deposits');
  }

  const product = typeof price.product === 'object' && price.product && !price.product.deleted
    ? price.product
    : null;
  const productId = product?.id || (typeof price.product === 'string' ? price.product : '');

  if (expectedProductId && productId && expectedProductId !== productId) {
    throw new Error(
      `Price ${priceId} belongs to ${productId}, not STRIPE_PRODUCT_ID ${expectedProductId}`
    );
  }

  if (expectedProductId && !productId) {
    const catalogProduct = await stripe.products.retrieve(expectedProductId);
    if (catalogProduct.deleted) {
      throw new Error('Stripe product was deleted');
    }
  }

  return {
    amountCents: price.unit_amount,
    currency: (price.currency || 'cad').toLowerCase(),
    productId: productId || expectedProductId,
    priceId,
    productName: 'Total Deposit',
  };
}
