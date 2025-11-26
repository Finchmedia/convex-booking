"use client";

import { useState, useRef } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "data-language"?: string;
  "data-theme"?: string;
}

export function CodeBlock({
  children,
  className,
  style,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const language = props["data-language"];

  const copyToClipboard = async () => {
    if (preRef.current) {
      const code = preRef.current.textContent || "";
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <figure
      className="group relative my-4 rounded-xl border border-border overflow-hidden text-sm not-prose bg-[var(--shiki-light-bg)] dark:bg-[var(--shiki-dark-bg)]"
      style={style}
    >
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between h-10 px-4 border-b border-border bg-muted/30">
        {language && (
          <span className="text-xs font-mono uppercase text-muted-foreground">
            {language}
          </span>
        )}
        {!language && <span />}
        <button
          type="button"
          onClick={copyToClipboard}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Code block */}
      <pre
        ref={preRef}
        className={`overflow-x-auto p-4 m-0 ${className || ""}`}
        {...props}
      >
        {children}
      </pre>
    </figure>
  );
}
