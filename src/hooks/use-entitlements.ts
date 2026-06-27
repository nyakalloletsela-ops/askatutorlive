import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyScopes, type FeatureScope } from "@/lib/entitlements.functions";
import { useAuth } from "@/hooks/use-auth";

export function useEntitlements() {
  const { user, isAdmin, isTutor } = useAuth();
  const fetchScopes = useServerFn(getMyScopes);
  const q = useQuery({
    queryKey: ["my-scopes", user?.id],
    queryFn: () => fetchScopes(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const scopes: FeatureScope[] = (q.data as FeatureScope[] | undefined) ?? [];
  const hasScope = (s: FeatureScope) => isAdmin || isTutor || scopes.includes(s);
  return { scopes, hasScope, loading: q.isLoading, refetch: q.refetch };
}
