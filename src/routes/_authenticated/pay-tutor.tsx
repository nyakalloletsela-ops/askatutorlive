import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ScopeGate } from "@/components/ScopeGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pay-tutor")({
  component: PayTutorPage,
  head: () => ({
    meta: [
      { title: "Pay a tutor — Ask A Tutor Live" },
      { name: "description", content: "Pay your tutor in bulk for one or many lessons using their tutor ID." },
    ],
  }),
});

type Pricing = { id: string; full_name: string; hourly_rate: number; currency: string };

function PayTutorPage() {
  return (
    <>
      <Navbar />
      <ScopeGate scope="find_tutors">
        <PayTutorInner />
      </ScopeGate>
    </>
  );
}

function PayTutorInner() {
  const [tutorId, setTutorId] = useState("");
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [lessons, setLessons] = useState(1);
  const [minutes, setMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const lookup = async () => {
    if (!tutorId.trim()) return;
    setLoading(true);
    setPricing(null);
    const { data, error } = await supabase.rpc("get_tutor_pricing", { _tutor: tutorId.trim() });
    setLoading(false);
    if (error) return toast.error(error.message);
    const row = (data as Pricing[] | null)?.[0];
    if (!row) return toast.error("Tutor not found");
    if (!row.hourly_rate || Number(row.hourly_rate) <= 0) {
      return toast.error("This tutor has no hourly rate set yet");
    }
    setPricing(row);
  };

  const total = pricing
    ? Number(pricing.hourly_rate) * (minutes / 60) * lessons
    : 0;

  const submit = async () => {
    if (!pricing) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_bulk_lesson_intent", {
      _tutor: pricing.id,
      _lessons: lessons,
      _lesson_minutes: minutes,
      _method: "manual",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(
      `Payment request created. Reference: ${data}. An admin will confirm once payment is received.`,
      { duration: 8000 },
    );
    setPricing(null);
    setTutorId("");
    setLessons(1);
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pay a tutor</h1>
        <p className="text-sm text-muted-foreground">
          Enter the tutor's ID to pay for one or more lessons in bulk. The total is calculated from
          their hourly rate.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-4 w-4" /> Step 1 — Find your tutor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="tid">Tutor ID</Label>
          <div className="flex gap-2">
            <Input
              id="tid"
              placeholder="paste tutor id (UUID)"
              value={tutorId}
              onChange={(e) => setTutorId(e.target.value)}
            />
            <Button onClick={lookup} disabled={loading || !tutorId.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {pricing && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Step 2 — Lessons</CardTitle>
            <p className="text-sm text-muted-foreground">
              {pricing.full_name} · ${Number(pricing.hourly_rate).toFixed(2)}/hr
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Number of lessons</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={lessons}
                  onChange={(e) => setLessons(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div>
                <Label>Lesson length</Label>
                <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                    <SelectItem value="90">90 min</SelectItem>
                    <SelectItem value="120">120 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {lessons} × {minutes} min × ${Number(pricing.hourly_rate).toFixed(2)}/hr
                </span>
                <span className="text-xl font-bold">${total.toFixed(2)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Includes a 5% platform commission. Your tutor gets ${(total * 0.95).toFixed(2)}.
              </p>
            </div>

            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
              Create payment request
            </Button>
            <p className="text-xs text-muted-foreground">
              After paying, an admin will confirm and your lessons will be credited. You can then book
              that many sessions with your tutor without paying again.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
