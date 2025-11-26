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
      <SidebarInset>
        <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <nav className="flex items-center gap-6 text-sm">
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
        <div className="flex flex-1 flex-col p-6">
          <article className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto w-full">
            {children}
          </article>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
