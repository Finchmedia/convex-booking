import type { MDXComponents } from "mdx/types";
import React from "react";
import { Callout } from "@/components/docs/callout";
import { CodeBlock } from "@/components/docs/code-block";
import { DocPage } from "@/components/docs/doc-page";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Handle figure elements from rehype-pretty-code (extracts title from figcaption)
    figure: ({ children, ...props }) => {
      const isCodeFigure = "data-rehype-pretty-code-figure" in props;
      if (!isCodeFigure) {
        return <figure {...props}>{children}</figure>;
      }

      // Extract title from figcaption
      let title: string | undefined;
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === "figcaption") {
          const figcaptionChildren = child.props.children;
          if (typeof figcaptionChildren === "string") {
            title = figcaptionChildren;
          }
        }
      });

      // Filter out figcaption, pass title to pre/CodeBlock
      const processed = React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        // Remove figcaption (already extracted title)
        if (child.props?.["data-rehype-pretty-code-title"] !== undefined) return null;
        // Pass title to element with data-language (the code block)
        if (child.props?.["data-language"] && title) {
          return React.cloneElement(child, { "data-title": title } as React.Attributes);
        }
        return child;
      });

      return <figure {...props}>{processed}</figure>;
    },
    // Default heading styles
    h1: ({ children }) => (
      <h1 className="scroll-m-20 text-4xl font-bold tracking-tight mb-6">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="scroll-m-20 border-b border-border pb-2 text-3xl font-semibold tracking-tight mt-10 mb-4 first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mt-8 mb-4">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3">
        {children}
      </h4>
    ),
    // Paragraph styling
    p: ({ children }) => (
      <p className="leading-7 [&:not(:first-child)]:mt-4 text-muted-foreground">
        {children}
      </p>
    ),
    // List styling
    ul: ({ children }) => (
      <ul className="my-4 ml-6 list-disc [&>li]:mt-2 text-muted-foreground">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-4 ml-6 list-decimal [&>li]:mt-2 text-muted-foreground">
        {children}
      </ol>
    ),
    // Inline code styling (code blocks are handled by CodeBlock via pre)
    code: ({ children, className, ...props }) => {
      // If it has a data-* attribute or language class, it's inside a code block - let it pass through
      const isBlockCode =
        className?.includes("language-") ||
        Object.keys(props).some((k) => k.startsWith("data-"));

      if (isBlockCode) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }

      // Inline code styling
      return (
        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
          {children}
        </code>
      );
    },
    // Code blocks with syntax highlighting via rehype-pretty-code
    pre: (props) => <CodeBlock {...props} />,
    // Link styling
    a: ({ href, children }) => (
      <a
        href={href}
        className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
      >
        {children}
      </a>
    ),
    // Blockquote styling
    blockquote: ({ children }) => (
      <blockquote className="mt-6 border-l-2 border-border pl-6 italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    // Table styling
    table: ({ children }) => (
      <div className="my-6 w-full overflow-y-auto">
        <table className="w-full">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">
        {children}
      </td>
    ),
    // Custom components
    Callout,
    DocPage,
    ...components,
  };
}
