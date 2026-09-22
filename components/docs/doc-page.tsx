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
