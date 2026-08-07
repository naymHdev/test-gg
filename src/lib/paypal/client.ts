import httpStatus from "http-status";
import AppError from "../../app/error/AppError";
import config from "../../app/config";

const PAYPAL_BASE_URL =
  config.paypal.mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// OAuth2 client-credentials token, cached in module memory and refreshed
// ~60s before actual expiry rather than on every request — PayPal tokens
// are normally valid ~9h, no reason to fetch a fresh one per call.
let tokenCache: { accessToken: string; expiresAt: number } | null = null;

const getAccessToken = async (): Promise<string> => {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const basicAuth = Buffer.from(
    `${config.paypal.client_id}:${config.paypal.client_secret}`,
  ).toString("base64");

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Failed to authenticate with PayPal",
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return tokenCache.accessToken;
};

const paypalFetch = async (path: string, init: RequestInit = {}) => {
  const accessToken = await getAccessToken();

  const res = await fetch(`${PAYPAL_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `PayPal request failed: ${body?.message ?? res.statusText}`,
    );
  }

  return body;
};

// Amount is fixed server-side at order-creation time — the client only
// ever sends back the orderId to capture, never an amount, so there's no
// way for a client to approve one amount and have us credit another.
export const createOrder = async (amount: number, referenceId: string) =>
  paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: referenceId,
          amount: { currency_code: "EUR", value: amount.toFixed(2) },
        },
      ],
    }),
  }) as Promise<{ id: string; status: string }>;

export const captureOrder = async (orderId: string) =>
  paypalFetch(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
  }) as Promise<{
    id: string;
    status: string;
    purchase_units: {
      reference_id: string;
      payments: {
        captures: { id: string; status: string; amount: { value: string } }[];
      };
    }[];
  }>;
