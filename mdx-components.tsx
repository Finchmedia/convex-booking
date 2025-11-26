import type { MDXComponents } from "mdx/types";
import { Callout } from "@/components/docs/callout";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
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
    // Code styling (inline)
    code: ({ children }) => (
      <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
        {children}
      </code>
    ),
    // Pre/code block styling is handled by rehype-pretty-code
    pre: ({ children, ...props }) => (
      <pre
        className="mb-4 mt-4 overflow-x-auto rounded-lg border border-border bg-neutral-900 p-4"
        {...props}
      >
        {children}
      </pre>
    ),
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
    ...components,
  };
}
