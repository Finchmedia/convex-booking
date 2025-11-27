"use client";

import { useState, useRef } from "react";
import { Check, Copy, Code } from "lucide-react";
import Image from "next/image";

// Language icon mapping using SVG files from public folder
const languageIcons: Record<string, { light: string; dark?: string }> = {
  typescript: { light: "/typescript.svg" },
  ts: { light: "/typescript.svg" },
  javascript: { light: "/javascript.svg" },
  js: { light: "/javascript.svg" },
  jsx: { light: "/javascript.svg" },
  tsx: { light: "/typescript.svg" },
  python: { light: "/python.svg" },
  py: { light: "/python.svg" },
  bash: { light: "/Bash_light.svg", dark: "/Bash_dark.svg" },
  shell: { light: "/Bash_light.svg", dark: "/Bash_dark.svg" },
  sh: { light: "/Bash_light.svg", dark: "/Bash_dark.svg" },
  json: { light: "/json.svg" },
  css: { light: "/css.svg" },
  html: { light: "/html5.svg" },
};

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "data-language"?: string;
  "data-theme"?: string;
  "data-title"?: string;
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
  const title = props["data-title"];

  const copyToClipboard = async () => {
    if (preRef.current) {
      const code = preRef.current.textContent || "";
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Get icon config for the language
  const iconConfig = language ? languageIcons[language.toLowerCase()] : null;

  return (
    <figure
      className="group relative my-4 rounded-xl border border-border overflow-hidden text-sm not-prose bg-[var(--shiki-light-bg)] dark:bg-[var(--shiki-dark-bg)]"
      style={style}
    >
      {/* Header with icon, filepath/title, and copy button */}
      <div className="flex items-center justify-between h-10 px-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          {iconConfig ? (
            <>
              {/* Light mode icon */}
              <Image
                src={iconConfig.light}
                alt={language || ""}
                width={16}
                height={16}
                className={iconConfig.dark ? "dark:hidden" : ""}
              />
              {/* Dark mode icon (if different) */}
              {iconConfig.dark && (
                <Image
                  src={iconConfig.dark}
                  alt={language || ""}
                  width={16}
                  height={16}
                  className="hidden dark:block"
                />
              )}
            </>
          ) : language ? (
            <Code className="w-4 h-4 text-muted-foreground" />
          ) : null}
          {title && (
            <span className="text-xs font-mono text-muted-foreground">
              {title}
            </span>
          )}
        </div>
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
