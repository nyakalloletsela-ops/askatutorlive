import { createFileRoute } from "@tanstack/react-router";

/**
 * Return URL hit by PayPal after the buyer approves the payment.
 * We capture the order, finalize the intent + ledger, then redirect the
 * user back into the app.
 */
export const Route = createFileRoute("/api/checkout/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const intentId = url.searchParams.get("intent");
        const paypalToken = url.searchParams.get("token"); // PayPal order id
        const origin = `${url.protocol}//${url.host}`;

        if (!intentId || !paypalToken) {
          return Response.redirect(`${origin}/checkout/failed?reason=missing_params`, 302);
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: intent, error: iErr } = await supabaseAdmin
            .from("payment_intents")
            .select("id, provider, provider_ref, status")
            .eq("id", intentId)
            .maybeSingle();
          if (iErr || !intent) {
            return Response.redirect(`${origin}/checkout/failed?reason=intent_not_found`, 302);
          }
          if (intent.status === "succeeded") {
            return Response.redirect(`${origin}/checkout/success?intent=${intentId}`, 302);
          }

          const { data: provider, error: pErr } = await supabaseAdmin
            .from("payment_providers")
            .select("slug, mode, credentials_ref")
            .eq("slug", intent.provider)
            .maybeSingle();
          if (pErr || !provider || !provider.credentials_ref) {
            return Response.redirect(`${origin}/checkout/failed?reason=provider_missing`, 302);
          }

          if (provider.slug === "paypal") {
            const { paypalCaptureOrder } = await import("@/lib/payments/paypal.server");
            const cap = await paypalCaptureOrder({
              mode: provider.mode as "sandbox" | "live",
              credentialsRef: provider.credentials_ref,
              orderId: paypalToken,
            });
            if (cap.status !== "COMPLETED") {
              await supabaseAdmin.rpc("mark_payment_failed", {
                _intent: intentId,
                _reason: `PayPal capture status: ${cap.status}`,
              });
              return Response.redirect(
                `${origin}/checkout/failed?reason=capture_${cap.status.toLowerCase()}`,
                302,
              );
            }
            await supabaseAdmin.rpc("finalize_payment_succeeded", {
              _intent: intentId,
              _provider: "paypal",
              _provider_ref: cap.captureId ?? paypalToken,
            });
            return Response.redirect(`${origin}/checkout/success?intent=${intentId}`, 302);
          }

          return Response.redirect(`${origin}/checkout/failed?reason=unknown_provider`, 302);
        } catch (e) {
          const msg = encodeURIComponent(e instanceof Error ? e.message : "capture_error");
          return Response.redirect(`${origin}/checkout/failed?reason=${msg}`, 302);
        }
      },
    },
  },
});
