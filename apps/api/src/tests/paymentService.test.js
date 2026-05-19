import test from "node:test";
import assert from "node:assert/strict";
import { createPaymentIntent } from "../services/paymentService.js";

// We'll create a mock stripe object
class MockStripe {
  constructor() {
    this.lastCreateCallArgs = null;
    this.paymentIntents = {
      create: async (args) => {
        this.lastCreateCallArgs = args;
        return {
          id: 'pi_test_123',
          client_secret: 'secret_test_123',
          amount: args.amount,
          currency: args.currency,
        };
      }
    };
  }
}

// For error testing
class MockStripeError extends MockStripe {
  constructor(errorToThrow) {
    super();
    this.errorToThrow = errorToThrow;
    this.paymentIntents.create = async () => {
      throw this.errorToThrow;
    };
  }
}

test("createPaymentIntent should throw error if amount is missing", async () => {
  const stripe = new MockStripe();
  try {
    await createPaymentIntent({}, stripe);
    assert.fail("Expected error for missing amount");
  } catch (error) {
    assert.equal(error.message, "Amount is required and must be a positive integer (in smallest currency unit, e.g. cents)");
  }
});

test("createPaymentIntent should throw error if amount is not positive", async () => {
  const stripe = new MockStripe();
  try {
    await createPaymentIntent({ amount: 0 }, stripe);
    assert.fail("Expected error for non-positive amount");
  } catch (error) {
    assert.equal(error.message, "Amount is required and must be a positive integer (in smallest currency unit, e.g. cents)");
  }
});

test("createPaymentIntent should throw error if amount is not an integer", async () => {
  const stripe = new MockStripe();
  try {
    await createPaymentIntent({ amount: 12.5 }, stripe);
    assert.fail("Expected error for non-integer amount");
  } catch (error) {
    assert.equal(error.message, "Amount is required and must be a positive integer (in smallest currency unit, e.g. cents)");
  }
});

test("createPaymentIntent should return paymentId and clientSecret", async () => {
  const stripe = new MockStripe();
  const payload = { amount: 1000, currency: "usd" };
  const result = await createPaymentIntent(payload, stripe);

  assert.equal(result.paymentId, "pi_test_123");
  assert.equal(result.clientSecret, "secret_test_123");
  assert.equal(result.amount, 1000);
  assert.equal(result.currency, 'usd');
  assert.equal(result.provider, 'stripe');
});

test("createPaymentIntent should use default currency", async () => {
  const stripe = new MockStripe();
  const payload = { amount: 500 };
  const result = await createPaymentIntent(payload, stripe);

  assert.equal(result.paymentId, "pi_test_123");
  assert.equal(result.clientSecret, "secret_test_123");
  assert.equal(stripe.lastCreateCallArgs.amount, 500);
  assert.equal(stripe.lastCreateCallArgs.currency, 'usd');
});

test("createPaymentIntent should pass metadata to stripe", async () => {
  const stripe = new MockStripe();
  const payload = {
    amount: 1000,
    currency: "eur",
    metadata: { order_id: "order_123" }
  };
  await createPaymentIntent(payload, stripe);
  assert.deepEqual(stripe.lastCreateCallArgs.metadata, { order_id: "order_123" });
});

// Test for Stripe error handling
test("createPaymentIntent should re-throw Stripe error messages", async () => {
  const error = new Error('Card declined');
  error.type = 'StripeCardError';
  const stripe = new MockStripeError(error);
  try {
    await createPaymentIntent({ amount: 100 }, stripe);
    assert.fail("Expected error to be thrown");
  } catch (thrownError) {
    assert.equal(thrownError.message, 'Card declined');
  }
});

test("createPaymentIntent should re-throw Stripe invalid request error", async () => {
  const error = new Error('Invalid amount');
  error.type = 'StripeInvalidRequestError';
  const stripe = new MockStripeError(error);
  try {
    await createPaymentIntent({ amount: 100 }, stripe);
    assert.fail("Expected error to be thrown");
  } catch (thrownError) {
    assert.equal(thrownError.message, 'Invalid amount');
  }
});

test("createPaymentIntent should handle generic stripe errors", async () => {
  const error = new Error('Network timeout');
  const stripe = new MockStripeError(error);
  try {
    await createPaymentIntent({ amount: 100 }, stripe);
    assert.fail("Expected error to be thrown");
  } catch (thrownError) {
    assert.equal(thrownError.message, 'Network timeout');
  }
});
