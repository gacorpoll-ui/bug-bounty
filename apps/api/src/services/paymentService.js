import Stripe from 'stripe';

// Create a Stripe instance that can be overridden for testing
let _stripe;
const initializeStripe = () => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }
  return _stripe;
};

export async function createPaymentIntent(payload, stripeInstance) {
  const stripe = stripeInstance ?? initializeStripe();

  // Validate amount: required, positive integer
  if (!payload.amount || typeof payload.amount !== 'number' || payload.amount <= 0 || !Number.isInteger(payload.amount)) {
    throw new Error('Amount is required and must be a positive integer (in smallest currency unit, e.g. cents)');
  }

  const amount = payload.amount;
  const currency = payload.currency ?? 'usd';

  try {
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      // Automatic payment methods enabled
      automatic_payment_methods: {
        enabled: true,
      },
      // Add any metadata if provided
      ...(payload.metadata && { metadata: payload.metadata })
    });

    return {
      paymentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      provider: 'stripe',
    };
  } catch (error) {
    // Handle Stripe errors and preserve original message
    if (error.type === 'StripeCardError' || error.type === 'StripeInvalidRequestError') {
      throw new Error(error.message);
    }
    throw error;
  }
}
