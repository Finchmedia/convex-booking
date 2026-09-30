"use client";

import { DocsTableOfContents, TocItem } from "./docs-toc";

interface DocPageProps {
  children: React.ReactNode;
  toc?: TocItem[];
}

export function DocPage({ children, toc }: DocPageProps) {
  const hasToc = !!toc?.length;

  return (
    <div className={hasToc ? "grid min-w-0 grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_14rem]" : "min-w-0"}>
      {/* Main content */}
      <article className="prose prose-neutral dark:prose-invert min-w-0 w-full max-w-3xl">
        {/* Version note: the pages describe one package version only. */}
        <p className="not-prose mb-6 text-sm text-muted-foreground">
          These docs describe <code className="font-mono">@mrfinch/booking</code> 0.5.x.
          For 0.4.x, see the{" "}
          <a
            href="https://github.com/Finchmedia/booking-component/tree/v0.4.3"
            className="underline underline-offset-4 hover:text-foreground"
          >
            v0.4.3 tag
          </a>
          .
        </p>
        {children}
      </article>

      {/* The desktop TOC has its own column, so it cannot cover the article. */}
      {hasToc && (
        <aside className="hidden w-56 xl:sticky xl:top-8 xl:block">
          <DocsTableOfContents toc={toc} />
        </aside>
      )}
    </div>
  );
}
