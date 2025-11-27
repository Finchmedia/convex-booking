"use client";

import * as React from "react";
import { List } from "lucide-react";

import { cn } from "@/lib/utils";

function useActiveItem(itemIds: string[]) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Find the scroll container (the one with overflow-auto in the docs layout)
    const scrollContainer = document.querySelector('[data-docs-scroll-container]');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        root: scrollContainer,
        rootMargin: "0% 0% -80% 0%"
      }
    );

    for (const id of itemIds ?? []) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => {
      for (const id of itemIds ?? []) {
        const element = document.getElementById(id);
        if (element) {
          observer.unobserve(element);
        }
      }
    };
  }, [itemIds]);

  return activeId;
}

export interface TocItem {
  title: string;
  url: string;
  depth: number;
}

export function DocsTableOfContents({
  toc,
  className,
}: {
  toc: TocItem[];
  className?: string;
}) {
  const itemIds = React.useMemo(
    () => toc.map((item) => item.url.replace("#", "")),
    [toc]
  );
  const activeHeading = useActiveItem(itemIds);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    const id = url.replace("#", "");
    const element = document.getElementById(id);

    if (element) {
      // Update URL without scrolling
      window.history.pushState(null, "", url);

      // Scroll the element into view within its scroll container
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!toc?.length) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-2 text-sm", className)}>
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
        <List className="size-4" />
        On This Page
      </div>
      <nav className="flex flex-col gap-1">
        {toc.map((item) => (
          <a
            key={item.url}
            href={item.url}
            onClick={(e) => handleClick(e, item.url)}
            className={cn(
              "text-muted-foreground hover:text-foreground text-[0.8rem] no-underline transition-colors py-1",
              item.url === `#${activeHeading}` && "text-foreground font-medium",
              item.depth === 3 && "pl-4",
              item.depth === 4 && "pl-6"
            )}
          >
            {item.title}
          </a>
        ))}
      </nav>
    </div>
  );
}
