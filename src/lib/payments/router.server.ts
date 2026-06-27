/**
 * PaymentRouter — SERVER ONLY.
 * Provider-agnostic. Loads active providers from `payment_providers` ordered by
 * priority (ASC), weighted by recent success rate (the "smart" part), and tries
 * them sequentially. Each attempt is logged in `payment_attempts`.
 */
import { paypalCreateOrder } from "./paypal.server";

export type ProviderRow = {
  id: string;
  slug: string;
  display_name: string;
  is_enabled: boolean;
  priority: number;
  mode: "sandbox" | "live";
  credentials_ref: string | null;
  supported_currencies: string[];
  supported_countries: string[];
  supported_regions: unknown;
  success_count: number;
  failure_count: number;
};

export type StartCheckoutResult = {
  providerSlug: string;
  approvalUrl: string;
  providerRef: string; // e.g. PayPal order id
};

/**
 * Smart score: lower is better. Combines admin-set priority with the provider's
 * recent failure ratio so a flaky provider naturally drifts down.
 */
function smartScore(p: ProviderRow): number {
  const total = p.success_count + p.failure_count;
  const failRate = total > 0 ? p.failure_count / total : 0;
  return p.priority * (1 + failRate);
}

function supports(p: ProviderRow, currency: string, country?: string): boolean {
  const okCur =
    p.supported_currencies.length === 0 ||
    p.supported_currencies.includes("*") ||
    p.supported_currencies.includes(currency.toUpperCase());
  const okCountry =
    !country ||
    p.supported_countries.length === 0 ||
    p.supported_countries.includes("*") ||
    p.supported_countries.includes(country.toUpperCase());
  return okCur && okCountry;
}

export async function selectProviders(
  currency: string,
  country: string | undefined,
): Promise<ProviderRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("payment_providers")
    .select("*")
    .eq("is_enabled", true);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ProviderRow[];
  return rows
    .filter((p) => p.credentials_ref && supports(p, currency, country))
    .sort((a, b) => smartScore(a) - smartScore(b));
}

async function recordAttempt(
  intentId: string,
  slug: string,
  status: "success" | "failed",
  reason: string | null,
  latency: number,
  providerRef: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.rpc("record_payment_attempt", {
    _intent: intentId,
    _provider: slug,
    _status: status,
    _failure_reason: reason ?? undefined,
    _latency_ms: latency,
    _provider_ref: providerRef ?? undefined,
  });
}

/**
 * Tries each provider in order. On first success returns the approval URL.
 * The intent's `provider` column is updated to whichever provider succeeded.
 */
export async function routeCheckoutStart(opts: {
  intentId: string;
  amountCents: number;
  currency: string;
  country?: string;
  returnUrl: string;
  cancelUrl: string;
  description?: string;
}): Promise<StartCheckoutResult> {
  const providers = await selectProviders(opts.currency, opts.country);
  if (providers.length === 0) {
    throw new Error(
      "No payment providers are available. An administrator must enable one in Admin → Payouts → Providers.",
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const errors: string[] = [];

  for (const p of providers) {
    const start = Date.now();
    try {
      if (p.slug === "paypal") {
        const order = await paypalCreateOrder({
          mode: p.mode,
          credentialsRef: p.credentials_ref!,
          amountCents: opts.amountCents,
          currency: opts.currency,
          intentId: opts.intentId,
          returnUrl: opts.returnUrl,
          cancelUrl: opts.cancelUrl,
          description: opts.description,
        });
        await recordAttempt(opts.intentId, p.slug, "success", null, Date.now() - start, order.id);
        await supabaseAdmin
          .from("payment_intents")
          .update({ provider: p.slug, provider_ref: order.id })
          .eq("id", opts.intentId);
        return { providerSlug: p.slug, approvalUrl: order.approvalUrl, providerRef: order.id };
      }
      // Future providers (flutterwave, dpo, mpesa, stripe) plug in here.
      throw new Error(`Provider "${p.slug}" has no server module yet`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await recordAttempt(opts.intentId, p.slug, "failed", msg, Date.now() - start, null);
      errors.push(`${p.slug}: ${msg}`);
    }
  }

  await supabaseAdmin.rpc("mark_payment_failed", {
    _intent: opts.intentId,
    _reason: errors.join(" | ").slice(0, 500),
  });
  throw new Error(`All payment providers failed. ${errors.join(" | ")}`);
}
