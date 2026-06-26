import { type ReactNode, useEffect, useMemo } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileText,
  StickyNote,
  Sparkles,
  MessageSquare,
  Calendar,
  Settings,
  Bell,
  Moon,
  Sun,
  LogOut,
  Search,
  ShieldCheck,
  BarChart3,
  Wallet,
  Flag,
  PencilRuler,
  FlaskConical,
  ChevronRight,
  Menu,
  Code2,
  FolderOpen,
  Baby,
  CalendarOff,
  CreditCard,
  Percent,
  Banknote,
} from "lucide-react";
import logoUrl from "@/assets/logo.png";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/dashboard/CommandPalette";

type NavItem = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  soon?: boolean;
};

const baseNav: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Tutors", to: "/tutors", icon: GraduationCap },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Assignments", to: "/assignments", icon: FileText },
  { label: "Records", to: "/records", icon: FolderOpen },
  { label: "Notes", to: "/notes", icon: StickyNote },
  { label: "My Lessons", to: "/lessons", icon: Calendar },
  { label: "Calendar", to: "/calendar", icon: Calendar },
  { label: "Resources", to: "/resources", icon: FolderOpen },
  { label: "Courses", to: "/courses", icon: FolderOpen },
  { label: "My Courses", to: "/my-courses", icon: FolderOpen },
];

const learningNav: NavItem[] = [
  { label: "AI Coach", to: "/ai-tutor", icon: Sparkles },
  { label: "AI Toolkit", to: "/ai-tools", icon: PencilRuler },
  { label: "Virtual Labs", to: "/labs", icon: FlaskConical },
  { label: "Code", to: "/code", icon: Code2 },
];

const parentNav: NavItem[] = [
  { label: "Parent Home", to: "/parent", icon: Baby },
  { label: "My Children", to: "/parent/children", icon: Users },
];

const tutorNav: NavItem[] = [
  { label: "Wallet", to: "/wallet", icon: Wallet },
  { label: "Availability", to: "/tutor/availability", icon: Calendar },
  { label: "Holidays", to: "/tutor/holidays", icon: CalendarOff },
];

const adminNav: NavItem[] = [
  { label: "Admin Console", to: "/admin", icon: ShieldCheck },
  { label: "Subscription Plans", to: "/admin/plans", icon: CreditCard },
  { label: "Commissions", to: "/admin/commissions", icon: Percent },
  { label: "Platform Audit", to: "/admin/audit", icon: ShieldCheck },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Payouts & Ledger", to: "/admin/payouts", icon: Banknote },
  { label: "Payment Providers", to: "/admin/payouts#providers", icon: CreditCard },
  { label: "Subscriptions", to: "/admin/payments", icon: Wallet },
  { label: "Promotions", to: "/admin/promotions", icon: Wallet },
  { label: "AI Controls", to: "/admin/ai", icon: Sparkles },
  { label: "Classrooms", to: "/admin/classrooms", icon: Users },
  { label: "Whiteboard", to: "/admin/whiteboard", icon: PencilRuler },
  { label: "Tutors", to: "/admin/tutors", icon: GraduationCap },
  { label: "Students", to: "/admin/students", icon: Users },
  { label: "Reports", to: "/admin/reports", icon: MessageSquare },
  { label: "Moderation", to: "/admin/moderation", icon: Flag },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, isAdmin, isTutor, isParent, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const initials = useMemo(() => {
    const name =
      (user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
      user?.email ??
      "U";
    return name
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [user]);

  const crumbs = useMemo(() => buildCrumbs(path), [path]);

  // Immersive routes: render children only, no shell chrome. Must come AFTER all hooks
  // above to keep hook order stable across route changes.
  const immersive = path.startsWith("/classroom/");
  if (immersive) return <>{children}</>;


  const isActive = (to: string) => {
    if (to === "/") return path === "/";
    if (to === "/dashboard") return path === "/dashboard";
    if (to === "/admin") return path.startsWith("/admin");
    return path.startsWith(to);
  };

  return (
    <SidebarProvider>

      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded-md object-contain" />
            <div className="flex-1 truncate group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold tracking-tight">Ask A Tutor</p>
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {isAdmin ? "Admin" : "Workspace"}
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {baseNav.map((item) => (
                  <NavLink key={item.label} item={item} active={isActive(item.to)} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Learning</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {learningNav.map((item) => (
                  <NavLink key={item.label} item={item} active={isActive(item.to)} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isParent && (
            <SidebarGroup>
              <SidebarGroupLabel>Parent</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {parentNav.map((item) => (
                    <NavLink key={item.label} item={item} active={isActive(item.to)} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {isTutor && (
            <SidebarGroup>
              <SidebarGroupLabel>Tutor tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {tutorNav.map((item) => (
                    <NavLink key={item.label} item={item} active={isActive(item.to)} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {isAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNav.map((item) => (
                    <NavLink key={item.label} item={item} active={isActive(item.to)} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Settings">
                <Link to="/settings">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {/* Topbar — glass */}
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-2 border-b border-border/60 bg-background/60 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50 sm:px-4">
          <SidebarTrigger className="md:hidden">
            <Menu className="h-4 w-4" />
          </SidebarTrigger>
          <SidebarTrigger className="hidden md:flex" />

          {/* Breadcrumbs */}
          <nav className="hidden min-w-0 items-center gap-1 text-sm md:flex">
            {crumbs.map((c, i) => (
              <div key={c.to} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                {i === crumbs.length - 1 ? (
                  <span className="truncate font-medium">{c.label}</span>
                ) : (
                  <Link
                    to={c.to as never}
                    className="truncate text-muted-foreground hover:text-foreground"
                  >
                    {c.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Search → opens command palette */}
          <button
            type="button"
            onClick={() => {
              const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
              window.dispatchEvent(ev);
            }}
            className="relative ml-auto hidden h-10 max-w-sm flex-1 items-center rounded-xl border bg-muted/40 pl-9 pr-12 text-left text-sm text-muted-foreground transition hover:bg-background sm:flex"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <span className="truncate">Search anything…</span>
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-6 -translate-y-1/2 select-none items-center gap-0.5 rounded-md border bg-background px-1.5 text-[10px] font-medium text-muted-foreground sm:flex">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1 sm:ml-2">
            <NotificationsBell />

            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              className="h-9 w-9"
              onClick={toggle}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium md:inline">
                    {(user?.user_metadata as { full_name?: string } | undefined)?.full_name?.split(" ")[0] ??
                      user?.email?.split("@")[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium">
                    {(user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
                      "Account"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/messages">
                    <MessageSquare className="mr-2 h-4 w-4" /> Messages
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="min-h-[calc(100svh-72px)] bg-[hsl(210_40%_98%)] dark:bg-background">{children}</div>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const inner = (
    <SidebarMenuButton
      asChild
      isActive={active}
      tooltip={item.label}
      className={cn(item.soon && "opacity-70")}
    >
      <Link to={item.to as never}>
        <item.icon className="h-4 w-4" />
        <span className="truncate">{item.label}</span>
        {item.soon && (
          <Badge
            variant="secondary"
            className="ml-auto h-4 px-1 text-[9px] font-medium uppercase tracking-wider group-data-[collapsible=icon]:hidden"
          >
            Soon
          </Badge>
        )}
        {item.badge && (
          <Badge className="ml-auto h-4 px-1 text-[10px] group-data-[collapsible=icon]:hidden">
            {item.badge}
          </Badge>
        )}
      </Link>
    </SidebarMenuButton>
  );
  return <SidebarMenuItem>{inner}</SidebarMenuItem>;
}

function buildCrumbs(path: string): { label: string; to: string }[] {
  if (path === "/dashboard") return [{ label: "Dashboard", to: "/dashboard" }];
  const segs = path.split("/").filter(Boolean);
  const crumbs: { label: string; to: string }[] = [
    { label: "Dashboard", to: "/dashboard" },
  ];
  let acc = "";
  for (const s of segs) {
    acc += "/" + s;
    if (s === "dashboard") continue;
    crumbs.push({ label: prettify(s), to: acc });
  }
  return crumbs;
}

function prettify(s: string) {
  if (s.startsWith("$")) return "Detail";
  return s
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: count = 0 } = useQuery({
    queryKey: ["notif-unread", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-bell-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notif-unread"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  return (
    <Button asChild variant="ghost" size="icon" aria-label="Notifications" className="relative h-9 w-9">
      <Link to="/notifications">
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
