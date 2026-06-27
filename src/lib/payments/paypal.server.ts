/**
 * PayPal provider module — SERVER ONLY.
 * Never import from client code. Filename ends in .server.ts to be excluded
 * from the client bundle.
 */

type Mode = "sandbox" | "live";

function baseUrl(mode: Mode) {
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function readCreds(ref: string) {
  // credentials_ref is a prefix like "PAYPAL". Real keys live in project secrets.
  const clientId = process.env[`${ref}_CLIENT_ID`];
  const secret = process.env[`${ref}_CLIENT_SECRET`];
  const webhookId = process.env[`${ref}_WEBHOOK_ID`];
  if (!clientId || !secret) {
    throw new Error(
      `Missing PayPal credentials (${ref}_CLIENT_ID / ${ref}_CLIENT_SECRET)`,
    );
  }
  return { clientId, secret, webhookId };
}

async function getAccessToken(mode: Mode, ref: string): Promise<string> {
  const { clientId, secret } = readCreds(ref);
  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${baseUrl(mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal oauth failed (${res.status}): ${await res.text()}`);
  }
  const j = (await res.json()) as { access_token: string };
  return j.access_token;
}

export async function paypalCreateOrder(opts: {
  mode: Mode;
  credentialsRef: string;
  amountCents: number;
  currency: string;
  intentId: string;
  returnUrl: string;
  cancelUrl: string;
  description?: string;
}): Promise<{ id: string; approvalUrl: string }> {
  const token = await getAccessToken(opts.mode, opts.credentialsRef);
  const amount = (opts.amountCents / 100).toFixed(2);
  const res = await fetch(`${baseUrl(opts.mode)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": opts.intentId, // idempotency
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: opts.intentId,
          description: opts.description ?? "AskATutorLive session",
          amount: { currency_code: opts.currency, value: amount },
          custom_id: opts.intentId,
        },
      ],
      application_context: {
        brand_name: "AskATutorLive",
        user_action: "PAY_NOW",
        return_url: opts.returnUrl,
        cancel_url: opts.cancelUrl,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`PayPal create order failed (${res.status}): ${await res.text()}`);
  }
  const j = (await res.json()) as {
    id: string;
    links: Array<{ rel: string; href: string }>;
  };
  const approval = j.links.find((l) => l.rel === "approve");
  if (!approval) throw new Error("PayPal returned no approval link");
  return { id: j.id, approvalUrl: approval.href };
}

export async function paypalCaptureOrder(opts: {
  mode: Mode;
  credentialsRef: string;
  orderId: string;
}): Promise<{ status: string; captureId?: string }> {
  const token = await getAccessToken(opts.mode, opts.credentialsRef);
  const res = await fetch(
    `${baseUrl(opts.mode)}/v2/checkout/orders/${opts.orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`PayPal capture failed (${res.status}): ${await res.text()}`);
  }
  const j = (await res.json()) as {
    status: string;
    purchase_units?: Array<{
      payments?: { captures?: Array<{ id: string; status: string }> };
    }>;
  };
  const cap = j.purchase_units?.[0]?.payments?.captures?.[0];
  return { status: j.status, captureId: cap?.id };
}

export async function paypalVerifyWebhook(opts: {
  mode: Mode;
  credentialsRef: string;
  headers: Headers;
  rawBody: string;
}): Promise<boolean> {
  const { webhookId } = readCreds(opts.credentialsRef);
  if (!webhookId) return false;
  const token = await getAccessToken(opts.mode, opts.credentialsRef);
  const payload = {
    auth_algo: opts.headers.get("paypal-auth-algo"),
    cert_url: opts.headers.get("paypal-cert-url"),
    transmission_id: opts.headers.get("paypal-transmission-id"),
    transmission_sig: opts.headers.get("paypal-transmission-sig"),
    transmission_time: opts.headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: JSON.parse(opts.rawBody),
  };
  const res = await fetch(
    `${baseUrl(opts.mode)}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) return false;
  const j = (await res.json()) as { verification_status: string };
  return j.verification_status === "SUCCESS";
}
