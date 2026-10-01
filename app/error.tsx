"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Fallback for errors thrown while rendering a page, such as a failed Convex
 * query (`useQuery` rethrows query errors during render). Shows a neutral
 * message rather than the error text, which may carry server diagnostics.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">Something went wrong</h1>
        <p className="text-muted-foreground mb-8">
          This page could not be loaded. Please try again.
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => retry()}>Try again</Button>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
