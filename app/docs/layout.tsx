"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DocsSidebar />
      <SidebarInset className="flex flex-col h-screen">
        <header className="bg-background sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <Link
              href="/docs"
              className="text-foreground font-medium"
            >
              Docs
            </Link>
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin
            </Link>
            <Link
              href="/book"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Try Booking
            </Link>
          </nav>
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <div className="flex-1 overflow-auto" data-docs-scroll-container>
          <div className="max-w-5xl mx-auto p-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
