import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/use-entitlements";
import type { FeatureScope } from "@/lib/entitlements.functions";

type Props = {
  scope: FeatureScope;
  title?: string;
  description?: string;
  children: React.ReactNode;
};

const labels: Record<FeatureScope, string> = {
  ai: "AI Tutor",
  find_tutors: "Find Tutors",
  labs: "Labs",
};

export function ScopeGate({ scope, title, description, children }: Props) {
  const { hasScope, loading } = useEntitlements();
  if (loading) return null;
  if (hasScope(scope)) return <>{children}</>;
  return (
    <div className="container mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>{title ?? `Subscribe to unlock ${labels[scope]}`}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {description ??
              `This area is part of the ${labels[scope]} plan. Subscribe to unlock it for your account.`}
          </p>
          <Button asChild>
            <Link to="/settings">View plans</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
