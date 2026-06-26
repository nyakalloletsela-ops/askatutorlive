import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search, CalendarCheck, Video, Sparkles, ShieldCheck, Globe2,
  Wallet, Headphones, Quote, Star, ArrowRight, Check,
} from "lucide-react";

/* ============== HOW IT WORKS ============== */
export function HowItWorks() {
  const steps = [
    { icon: Search, title: "Find your tutor", desc: "Search by subject, level or language. Filter by price and ratings." },
    { icon: CalendarCheck, title: "Book a slot", desc: "Pick a time that suits you. Free trial minutes on your first session." },
    { icon: Video, title: "Join the classroom", desc: "Live HD video, interactive whiteboard, AI tools and file sharing." },
  ];
  return (
    <section className="border-y border-border/60 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <Badge variant="secondary" className="mb-3">How it works</Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            From homepage to live class in under 10 seconds.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Card key={s.title} className="relative border-border/60">
              <CardContent className="p-6">
                <div className="absolute -top-3 left-6 rounded-full bg-aurora px-3 py-1 text-xs font-semibold text-white shadow-glow-electric">
                  Step {i + 1}
                </div>
                <s.icon className="mt-3 h-8 w-8 text-electric" />
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============== WHY US ============== */
export function WhyUs() {
  const items = [
    { icon: ShieldCheck, title: "Verified tutors", desc: "Every tutor passes ID, qualifications and interview checks." },
    { icon: Sparkles, title: "AI in every lesson", desc: "Auto notes, translator and step-by-step problem solver built-in." },
    { icon: Globe2, title: "Africa-first payments", desc: "Card, M-Pesa, EcoCash, Airtel Money, Orange Money and bank transfer." },
    { icon: Wallet, title: "Pay tutors in bulk", desc: "Subscribe to find tutors, then prepay lessons by tutor ID at their hourly rate." },
    { icon: Video, title: "Built-in classroom", desc: "HD video, whiteboard, screen share, file sharing — no extra app." },
    { icon: Headphones, title: "Human support", desc: "Real people, fast replies, 7 days a week." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="mb-10 text-center">
        <Badge variant="secondary" className="mb-3">Why AskATutorLive</Badge>
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Built for serious learners, not just clicks.
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <Card key={it.title} className="border-border/60 transition hover:border-electric hover:shadow-glow-electric">
            <CardContent className="p-5">
              <it.icon className="h-6 w-6 text-electric" />
              <h3 className="mt-3 font-semibold">{it.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{it.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ============== SUCCESS STORIES ============== */
export function SuccessStories() {
  const stories = [
    { name: "Tariro M.", role: "A-Level student", quote: "I went from a D to an A in Mathematics in one term. The whiteboard sessions are next level.", rating: 5 },
    { name: "Kwame O.", role: "Parent", quote: "I can sit in on my son's lessons and see his progress every week. Worth every cent.", rating: 5 },
    { name: "Dr. Ada N.", role: "Physics tutor", quote: "Best platform I've taught on. Reliable payouts and great students.", rating: 5 },
  ];
  return (
    <section className="border-y border-border/60 bg-gradient-to-b from-muted/20 to-background">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <Badge variant="secondary" className="mb-3">Success stories</Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Real results from real students.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {stories.map((s) => (
            <Card key={s.name} className="border-border/60">
              <CardContent className="p-6">
                <Quote className="h-6 w-6 text-electric/60" />
                <p className="mt-3 text-sm text-foreground/90">"{s.quote}"</p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-aurora text-sm font-semibold text-white">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.role}</div>
                  </div>
                  <div className="flex">
                    {Array.from({ length: s.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============== PRICING SNAPSHOT ============== */
export function PricingSnapshot() {
  const tiers = [
    {
      name: "Try free",
      price: "0",
      tagline: "300 free minutes on signup",
      features: ["No card required", "Browse all tutors", "1:1 trial lessons"],
      cta: "Create free account",
      to: "/auth" as const,
      highlight: false,
    },
    {
      name: "Pay as you go",
      price: "M50–M200",
      tagline: "Per hour, depending on tutor",
      features: ["Top up anytime", "Card & mobile money", "No commitment"],
      cta: "Find a tutor",
      to: "/tutors" as const,
      highlight: true,
    },
    {
      name: "Monthly plan",
      price: "From M450",
      tagline: "Best for weekly learners",
      features: ["Includes 10+ hours", "Priority booking", "Cancel anytime"],
      cta: "See plans",
      to: "/tutors" as const,
      highlight: false,
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="mb-10 text-center">
        <Badge variant="secondary" className="mb-3">Pricing</Badge>
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Simple pricing. Start free.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Every new student gets 300 free minutes. Use them on any tutor, any subject.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={`relative border-border/60 ${tier.highlight ? "border-electric shadow-glow-electric" : ""}`}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-aurora px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </div>
            )}
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <div className="mt-3 text-3xl font-semibold tracking-tight">{tier.price}</div>
              <p className="mt-1 text-xs text-muted-foreground">{tier.tagline}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-electric" /> {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full" variant={tier.highlight ? "default" : "outline"}>
                <Link to={tier.to}>{tier.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ============== FAQ ============== */
export function FAQ() {
  const faqs = [
    { q: "How do I book a tutor?", a: "Search by subject, pick a tutor, choose a time slot, pay and join the classroom — usually under 10 seconds." },
    { q: "Do I need to install anything?", a: "No. The classroom runs in your browser with HD video, whiteboard and AI tools built-in." },
    { q: "What payment methods do you accept?", a: "Card, M-Pesa, EcoCash, Airtel Money, Orange Money and bank transfer." },
    { q: "Are tutors verified?", a: "Yes. Every tutor passes ID, qualifications, motivation and live interview checks before being listed." },
    { q: "Can I cancel a booking?", a: "Yes — cancellations more than 12 hours before the lesson get a full refund to your wallet." },
    { q: "What subjects do you cover?", a: "Primary, High School, IGCSE, A-Level and Undergraduate across Maths, Sciences, Languages, Coding, Business and more." },
    { q: "Can parents track progress?", a: "Yes. Parent accounts can link to children and view session history, homework and tutor reports." },
    { q: "Is there a free trial?", a: "Every new student gets 300 free minutes to try any tutor — no card required." },
    { q: "Can I become a tutor?", a: "Yes. Submit your ID, qualifications, CV, motivational letter and a short intro video. Most applications are reviewed within 48 hours." },
    { q: "Where are you available?", a: "Anywhere with internet. We support payments and tutors across Africa and beyond." },
  ];
  return (
    <section className="border-y border-border/60 bg-muted/20">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-3">FAQ</Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Questions, answered.
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-sm font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ============== FINAL CTA ============== */
export function FinalCTA() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      <div className="relative overflow-hidden rounded-3xl border border-electric bg-gradient-to-br from-primary/10 via-background to-background p-10 text-center shadow-glow-electric md:p-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <Badge variant="secondary" className="mb-4">Start now</Badge>
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          Start learning in under <span className="text-aurora">10 seconds</span>.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
          Create a free account, pick a tutor and join your first live lesson today.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-aurora text-white shadow-glow-electric hover:opacity-90">
            <Link to="/tutors">Find a tutor <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-electric text-electric hover:bg-primary/10">
            <Link to="/auth">Create free account</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ============== TRUST STRIP ============== */
export function TrustStrip() {
  const stats = [
    { v: "12k+", l: "Students taught" },
    { v: "350+", l: "Verified tutors" },
    { v: "4.9★", l: "Average rating" },
    { v: "20+", l: "Countries" },
  ];
  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="text-center">
            <div className="text-2xl font-semibold tracking-tight text-aurora md:text-3xl">{s.v}</div>
            <div className="text-xs text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
