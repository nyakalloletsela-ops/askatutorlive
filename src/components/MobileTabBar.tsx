import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutDashboard, Sparkles, FlaskConical, User, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const tabs = [
  { to: "/" as const, label: "Tutors", icon: Home },
  { to: "/labs" as const, label: "Labs", icon: FlaskConical },
  { to: "/ai-tools" as const, label: "AI", icon: Sparkles, authed: true },
  { to: "/dashboard" as const, label: "Me", icon: LayoutDashboard, authed: true },
  { to: "/admin" as const, label: "Admin", icon: Shield, admin: true },
  { to: "/auth" as const, label: "Sign in", icon: User, guest: true },
];

export function MobileTabBar() {
  const { user, isAdmin } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });

  // Hide on classroom (immersive) and authenticated routes (AppShell sidebar handles nav)
  if (
    path.startsWith("/classroom/") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/ai-tools") ||
    path.startsWith("/ai-tutor") ||
    path.startsWith("/messages") ||
    path.startsWith("/assignments") ||
    path.startsWith("/notes") ||
    path.startsWith("/calendar") ||
    path.startsWith("/code") ||
    path.startsWith("/become-tutor") ||
    path.startsWith("/certificate")
  )
    return null;


  const visible = tabs.filter((t) => {
    if (t.authed && !user) return false;
    if (t.guest && user) return false;
    if (t.admin && !isAdmin) return false;
    return true;
  });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {visible.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "drop-shadow-[0_0_6px_currentColor]" : ""}`} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
