import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartSchema = z.object({
  tutorId: z.string().uuid(),
  sessionId: z.string().uuid().nullable().optional(),
  amountCents: z.number().int().positive().max(10_000_000),
  currency: z.string().trim().min(3).max(8).default("USD"),
  subject: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(240).optional(),
  country: z.string().trim().max(4).optional(),
});

/**
 * Student-callable: creates a payment_intent and routes through the
 * PaymentRouter (PayPal today, more providers as admins enable them).
 * Returns the approval URL to redirect to.
 */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => StartSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getRequestHost } = await import("@tanstack/react-start/server");

    // commission via existing RPC
    const { data: commission, error: cErr } = await supabase.rpc(
      "compute_commission_cents",
      { _amount_cents: data.amountCents, _tutor: data.tutorId, _subject: data.subject ?? undefined },
    );
    if (cErr) throw new Error(cErr.message);
    const commissionCents = Number(commission ?? 0);
    const tutorNetCents = data.amountCents - commissionCents;

    const { data: intentRow, error: iErr } = await supabase
      .from("payment_intents")
      .insert({
        student_id: userId,
        tutor_id: data.tutorId,
        session_id: data.sessionId ?? null,
        provider: "pending",
        gross_cents: data.amountCents,
        currency: data.currency.toUpperCase(),
        commission_cents: commissionCents,
        tutor_net_cents: tutorNetCents,
        status: "pending",
        metadata: { subject: data.subject ?? null },
      })
      .select("id")
      .single();
    if (iErr || !intentRow) throw new Error(iErr?.message ?? "Could not create payment intent");

    const host = getRequestHost();
    const proto = host.startsWith("localhost") ? "http" : "https";
    const base = `${proto}://${host}`;
    const returnUrl = `${base}/api/checkout/return?intent=${intentRow.id}`;
    const cancelUrl = `${base}/checkout/cancelled?intent=${intentRow.id}`;

    const { routeCheckoutStart } = await import("./router.server");
    const result = await routeCheckoutStart({
      intentId: intentRow.id,
      amountCents: data.amountCents,
      currency: data.currency.toUpperCase(),
      country: data.country,
      returnUrl,
      cancelUrl,
      description: data.description,
    });

    return {
      intentId: intentRow.id,
      approvalUrl: result.approvalUrl,
      provider: result.providerSlug,
    };
  });
