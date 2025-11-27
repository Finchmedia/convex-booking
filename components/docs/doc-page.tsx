"use client";

import { DocsTableOfContents, TocItem } from "./docs-toc";

interface DocPageProps {
  children: React.ReactNode;
  toc?: TocItem[];
}

export function DocPage({ children, toc }: DocPageProps) {
  return (
    <>
      {/* Main content */}
      <article className="prose prose-neutral dark:prose-invert max-w-3xl">
        {children}
      </article>

      {/* TOC - fixed position on desktop */}
      {toc && toc.length > 0 && (
        <aside className="hidden xl:block fixed top-24 right-8 w-56">
          <DocsTableOfContents toc={toc} />
        </aside>
      )}
    </>
  );
}
