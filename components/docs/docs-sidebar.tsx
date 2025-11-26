"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  title: string;
  href?: string;
  items?: NavItem[];
}

const navigation: NavItem[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", href: "/docs" },
      { title: "Quick Start", href: "/docs/getting-started" },
      { title: "Installation", href: "/docs/installation" },
    ],
  },
  {
    title: "Core Concepts",
    items: [
      { title: "Architecture", href: "/docs/concepts/architecture" },
      { title: "Resources", href: "/docs/concepts/resources" },
      { title: "Schedules", href: "/docs/concepts/schedules" },
      { title: "Event Types", href: "/docs/concepts/event-types" },
      { title: "Presence System", href: "/docs/concepts/presence" },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "Basic Booking", href: "/docs/guides/basic-booking" },
      { title: "Multi-Duration", href: "/docs/guides/multi-duration" },
      { title: "Multi-Resource", href: "/docs/guides/multi-resource" },
      { title: "Add-on Resources", href: "/docs/guides/addons" },
      { title: "Timezones", href: "/docs/guides/timezones" },
      { title: "Webhooks", href: "/docs/guides/webhooks" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { title: "Queries", href: "/docs/api/queries" },
      { title: "Mutations", href: "/docs/api/mutations" },
      { title: "Frontend Hooks", href: "/docs/api/hooks" },
    ],
  },
  {
    title: "Components",
    items: [
      { title: "Booker", href: "/docs/components/booker" },
      { title: "Calendar", href: "/docs/components/calendar" },
      { title: "Booking Form", href: "/docs/components/booking-form" },
      { title: "Admin UI", href: "/docs/components/admin" },
    ],
  },
  {
    title: "Advanced",
    items: [
      { title: "Performance", href: "/docs/advanced/performance" },
      { title: "Customization", href: "/docs/advanced/customization" },
      { title: "Schema Reference", href: "/docs/advanced/schema" },
    ],
  },
];

function NavSection({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = item.items?.some((child) => child.href === pathname);

  return (
    <Collapsible defaultOpen={isActive || true} className="group">
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold text-foreground hover:text-foreground/80">
        {item.title}
        <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-2 border-l border-border pl-3 pb-2">
          {item.items?.map((child) => (
            <NavLink key={child.href} item={child} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href || "#"}
      className={cn(
        "block py-1.5 text-sm transition-colors",
        isActive
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {item.title}
    </Link>
  );
}

export function DocsSidebar() {
  return (
    <ScrollArea className="h-full py-6 pr-6">
      <nav className="space-y-1">
        {navigation.map((item) => (
          <NavSection key={item.title} item={item} />
        ))}
      </nav>
    </ScrollArea>
  );
}

export function DocsMobileNav() {
  return (
    <nav className="space-y-1 p-4">
      {navigation.map((item) => (
        <NavSection key={item.title} item={item} />
      ))}
    </nav>
  );
}
