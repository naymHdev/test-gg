import Stripe from "stripe";
import config from "../../app/config";

export const stripe = new Stripe(config.stripe.stripe_secret_key!, {
  apiVersion: "2026-06-24.dahlia",
});
