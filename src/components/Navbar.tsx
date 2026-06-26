import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Moon, Sun, Menu, X, Bell } from "lucide-react";
import logo from "@/assets/logo.png";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Routes where the AppShell already provides its own top bar.
// Returning null avoids duplicate chrome without touching every page.
const APP_SHELL_PREFIXES = [
  "/dashboard",
  "/admin",
  "/ai-tools",
  "/ai-tutor",
  "/messages",
  "/assignments",
  "/notes",
  "/calendar",
  "/code",
  "/become-tutor",
  "/certificate",
  "/labs",
  "/classroom",
];

export function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);


  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    const load = async () => {
      // Subscriptions hidden until free options are finalised — only count course approvals.
      const { count: courses } = await supabase
        .from("tutor_courses").select("id", { count: "exact", head: true }).eq("status", "pending");
      if (alive) setPendingCount(courses ?? 0);
    };
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [isAdmin]);

  if (APP_SHELL_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    return null;
  }




  const links = (
    <>
      <Link to="/" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
        Find Tutors
      </Link>
      <Link to="/labs" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
        Virtual Labs
      </Link>
      <Link to="/community" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
        Community
      </Link>
      <Link to="/leaderboard" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
        Leaderboard
      </Link>
      {user && (
        <>
          <Link to="/dashboard" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
            Dashboard
          </Link>
          <Link to="/ai-tools" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
            AI Toolkit
          </Link>
          <Link to="/ai-tutor" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
            AI Coach
          </Link>
          <Link to="/code" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
            Code
          </Link>
          {isAdmin && (
            <Link to="/admin" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-accent">
              Admin
            </Link>
          )}
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <img src={logo} alt="Ask A Tutor Live logo" className="h-9 w-9 object-contain" />
          <span className="text-lg tracking-tight">
            Ask A Tutor <span className="text-aurora">Live</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="ml-2 rounded-md p-2 text-foreground/70 hover:bg-accent hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {isAdmin && (
            <Link
              to="/admin"
              aria-label={`Admin notifications${pendingCount ? `: ${pendingCount} pending` : ""}`}
              className="relative ml-1 rounded-md p-2 text-foreground/70 hover:bg-accent hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {pendingCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </Link>
          )}
          {user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}

            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild size="sm" className="bg-aurora text-white hover:opacity-90">
              <Link to="/auth">Get started</Link>
            </Button>
          )}
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-md p-2 text-foreground/70 hover:bg-accent"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="rounded-md p-2 hover:bg-accent"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
          <div className="flex flex-col gap-1 px-4 py-3">
            {links}
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={async () => { await signOut(); setOpen(false); navigate({ to: "/" }); }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            ) : (
              <Button asChild size="sm" className="mt-2 bg-aurora text-white">
                <Link to="/auth" onClick={() => setOpen(false)}>Get started</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
