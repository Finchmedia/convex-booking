"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAuthActions,
} from "@convex-dev/auth/react";
import { useAnonymousAuth } from "@convex-dev/auth/providers/anonymous/react";
import { api } from "@/convex/_generated/api";
import {
  Calendar,
  CalendarDays,
  Clock,
  LayoutDashboard,
  Users,
  ChevronLeft,
  BookOpen,
  LogOut,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const SANDBOX_NOTICE =
  "This is a shared sandbox: anyone can edit, everything resets every hour.";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Event Types",
    href: "/admin/event-types",
    icon: Calendar,
  },
  {
    title: "Bookings",
    href: "/admin/bookings",
    icon: CalendarDays,
  },
  {
    title: "Schedules",
    href: "/admin/schedules",
    icon: Clock,
  },
  {
    title: "Resources",
    href: "/admin/resources",
    icon: Users,
  },
];

function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/admin" className="flex items-center gap-2 px-2">
          <Image
            src="/convex_booking_logo.png"
            alt="ConvexBooking"
            width={32}
            height={32}
            className="dark:invert"
          />
          <span className="font-semibold text-lg">ConvexBooking</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname.startsWith(item.href)
                    }
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/docs">
                    <BookOpen className="h-4 w-4" />
                    <span>Documentation</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/book">
                    <Calendar className="h-4 w-4" />
                    <span>Try Booking</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/">
                    <ChevronLeft className="h-4 w-4" />
                    <span>Back to Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * Shown while Convex Auth restores a stored session (or finishes the
 * handshake right after "Continue as guest admin").
 */
function AdminGateSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-8 w-48 mx-auto bg-muted" />
        <Skeleton className="h-44 w-full bg-muted" />
      </div>
    </div>
  );
}

/**
 * The admin gate: one click mints an anonymous Convex Auth session. Nothing
 * else is required — the point is an explicit, sessioned step (and a user id
 * for audit fields), not identity.
 */
function GuestAdminGate() {
  const { signInAnonymous } = useAnonymousAuth(api.auth.signInAnonymous);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setIsPending(true);
    setError(null);
    try {
      await signInAnonymous();
      // <Authenticated> takes over once the session is established and this
      // component unmounts, so the pending state is intentionally left set.
    } catch (err) {
      console.error("Guest sign-in failed:", err);
      setError("Could not start a guest session. Please try again.");
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md bg-card/50 border-border">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-2">
            <Image
              src="/convex_booking_logo.png"
              alt="ConvexBooking"
              width={40}
              height={40}
              className="dark:invert"
            />
          </Link>
          <CardTitle className="text-2xl">Guest admin access</CardTitle>
          <CardDescription>{SANDBOX_NOTICE}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={handleContinue}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting guest session...
              </>
            ) : (
              "Continue as guest admin"
            )}
          </Button>
          {error && (
            <p className="text-sm text-destructive text-center" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground text-center">
            No account needed. Your guest session is anonymous and is cleaned
            up with the next hourly reset.
          </p>
          <div className="text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SessionControls() {
  const { signOut } = useAuthActions();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      // <Unauthenticated> takes over; this component unmounts.
    } catch (err) {
      console.error("Sign-out failed:", err);
      toast.error("Sign-out failed. Please try again.");
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
        title={SANDBOX_NOTICE}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Guest admin · shared sandbox · resets every hour
      </span>
      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-muted disabled:opacity-50"
        title="Sign out of the guest session"
        aria-label="Sign out of the guest session"
      >
        {isSigningOut ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1" />
          <SessionControls />
          <ThemeToggle />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthLoading>
        <AdminGateSkeleton />
      </AuthLoading>
      <Unauthenticated>
        <GuestAdminGate />
      </Unauthenticated>
      <Authenticated>
        <AdminShell>{children}</AdminShell>
      </Authenticated>
    </>
  );
}
