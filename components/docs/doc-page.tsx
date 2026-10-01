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
        {/* Version note: the pages describe one package version only. The same
            two links as on the upgrading page: the component README for 0.4.3,
            this site's docs-0.4 tag for 0.4.2. */}
        <p className="not-prose mb-6 text-sm text-muted-foreground">
          These docs describe <code className="font-mono">@mrfinch/booking</code> 0.5.x.
          For 0.4.x, see the component&apos;s{" "}
          <a
            href="https://github.com/Finchmedia/booking-component/tree/v0.4.3"
            className="underline underline-offset-4 hover:text-foreground"
          >
            README at v0.4.3
          </a>{" "}
          or this site&apos;s{" "}
          <a
            href="https://github.com/Finchmedia/convex-booking/tree/docs-0.4/app/docs"
            className="underline underline-offset-4 hover:text-foreground"
          >
            0.4.2 docs
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
