import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startCheckout } from "@/lib/payments/checkout.functions";

type Props = {
  tutorId: string;
  amountCents: number;
  currency?: string;
  sessionId?: string | null;
  subject?: string | null;
  description?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Single unified Pay button. Calls the PaymentRouter; the user never sees
 * which provider is used. Redirects to the provider's approval page.
 */
export function PayButton({
  tutorId,
  amountCents,
  currency = "USD",
  sessionId,
  subject,
  description,
  label,
  className,
  disabled,
}: Props) {
  const [busy, setBusy] = useState(false);
  const start = useServerFn(startCheckout);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await start({
        data: {
          tutorId,
          amountCents,
          currency,
          sessionId: sessionId ?? null,
          subject: subject ?? null,
          description,
        },
      });
      window.location.href = r.approvalUrl;
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
    }
  };

  const fmt = (cents: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
      }).format(cents / 100);
    } catch {
      return `${currency} ${(cents / 100).toFixed(2)}`;
    }
  };

  return (
    <Button onClick={onClick} disabled={disabled || busy} className={className}>
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Lock className="mr-2 h-4 w-4" />
      )}
      {busy ? "Processing…" : label ?? `Pay ${fmt(amountCents)}`}
    </Button>
  );
}
