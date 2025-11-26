"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

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

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2">
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
        {navigation.map((section) => (
          <Collapsible
            key={section.title}
            defaultOpen
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
              >
                <CollapsibleTrigger>
                  {section.title}
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items?.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.href}
                        >
                          <Link href={item.href || "#"}>{item.title}</Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
