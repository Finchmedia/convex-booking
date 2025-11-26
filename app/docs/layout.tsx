"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { DocsSidebar, DocsMobileNav } from "@/components/docs/docs-sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          {/* Mobile menu trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="border-b border-border p-4">
                <Link href="/" className="flex items-center gap-2">
                  <Image
                    src="/convex_booking_logo.png"
                    alt="ConvexBooking"
                    width={24}
                    height={24}
                    className="dark:invert"
                  />
                  <span className="font-semibold">ConvexBooking</span>
                </Link>
              </div>
              <DocsMobileNav />
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mr-6">
            <Image
              src="/convex_booking_logo.png"
              alt="ConvexBooking"
              width={24}
              height={24}
              className="dark:invert"
            />
            <span className="font-semibold hidden sm:inline-block">ConvexBooking</span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/docs"
              className="text-foreground font-medium"
            >
              Docs
            </Link>
            <Link
              href="/demo"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Demo
            </Link>
            <Link
              href="/book"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Try Booking
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <div className="container flex-1">
        <div className="flex">
          {/* Sidebar - hidden on mobile */}
          <aside className="hidden md:block w-64 shrink-0 border-r border-border">
            <div className="sticky top-14 h-[calc(100vh-3.5rem)]">
              <DocsSidebar />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <div className="max-w-3xl mx-auto py-10 px-6">
              <article className="prose prose-neutral dark:prose-invert max-w-none">
                {children}
              </article>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
