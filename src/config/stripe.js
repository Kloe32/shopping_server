import Stripe from "stripe";
import config from "./config.js";

const stripe = config.STRIPE_SECRET_KEY
  ? new Stripe(config.STRIPE_SECRET_KEY)
  : null;

const getStripeInstance = () => {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Please provide STRIPE_SECRET_KEY in your environment.",
    );
  }
  return stripe;
};

const createPaymentIntent = async ({
  amount,
  currency = config.STRIPE_CURRENCY,
  orderId,
  orderNumber,
  customerEmail,
  metadata = {},
}) => {
  const stripeClient = getStripeInstance();

  // Stripe requires amount in smallest currency unit (e.g., cents for USD)
  const amountInCents = Math.round(Number(amount) * 100);

  const paymentIntent = await stripeClient.paymentIntents.create({
    amount: amountInCents,
    currency: currency.toLowerCase(),
    receipt_email: customerEmail || undefined,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      orderId: String(orderId),
      orderNumber: String(orderNumber),
      ...metadata,
    },
  });

  return paymentIntent;
};

const constructWebhookEvent = (rawBody, signature) => {
  const stripeClient = getStripeInstance();
  const webhookSecret = (config.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!webhookSecret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not configured in environment.",
    );
  }

  return stripeClient.webhooks.constructEvent(
    rawBody,
    signature,
    webhookSecret,
  );
};

export {
  stripe,
  getStripeInstance,
  createPaymentIntent,
  constructWebhookEvent,
};
