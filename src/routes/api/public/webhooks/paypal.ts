import { createFileRoute } from "@tanstack/react-router";

/**
 * PayPal webhook receiver. Verifies signature, then finalizes the matching
 * payment_intent. Idempotent — calling twice with the same event is safe
 * because finalize_payment_succeeded short-circuits when status is already
 * 'succeeded'.
 *
 * Endpoint URL (paste into PayPal Developer → Webhooks):
 *   https://askatutor.lovable.app/api/public/webhooks/paypal
 */
export const Route = createFileRoute("/api/public/webhooks/paypal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        let event: { event_type?: string; resource?: Record<string, unknown> };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: provider } = await supabaseAdmin
          .from("payment_providers")
          .select("mode, credentials_ref")
          .eq("slug", "paypal")
          .maybeSingle();
        if (!provider || !provider.credentials_ref) {
          return new Response("PayPal not configured", { status: 503 });
        }

        const { paypalVerifyWebhook } = await import("@/lib/payments/paypal.server");
        const ok = await paypalVerifyWebhook({
          mode: provider.mode as "sandbox" | "live",
          credentialsRef: provider.credentials_ref,
          headers: request.headers,
          rawBody,
        });
        if (!ok) return new Response("Invalid signature", { status: 401 });

        const type = event.event_type ?? "";
        const resource = (event.resource ?? {}) as Record<string, unknown>;

        if (
          type === "CHECKOUT.ORDER.APPROVED" ||
          type === "PAYMENT.CAPTURE.COMPLETED"
        ) {
          // Match either by custom_id on the capture or supplementary_data on the order
          const customId =
            (resource.custom_id as string | undefined) ??
            (
              (resource as { supplementary_data?: { related_ids?: { order_id?: string } } })
                .supplementary_data?.related_ids?.order_id
            );
          const providerRef =
            (resource.id as string | undefined) ??
            (resource as { invoice_id?: string }).invoice_id;

          if (customId && providerRef) {
            try {
              await supabaseAdmin.rpc("finalize_payment_succeeded", {
                _intent: customId,
                _provider: "paypal",
                _provider_ref: providerRef,
              });
            } catch (e) {
              // Already finalized or unknown intent — log only.
              console.error("[paypal webhook] finalize error:", e);
            }
          }
        } else if (
          type === "PAYMENT.CAPTURE.DENIED" ||
          type === "PAYMENT.CAPTURE.DECLINED"
        ) {
          const customId = resource.custom_id as string | undefined;
          if (customId) {
            await supabaseAdmin.rpc("mark_payment_failed", {
              _intent: customId,
              _reason: `PayPal: ${type}`,
            });
          }
        }

        return new Response("ok");
      },
    },
  },
});
