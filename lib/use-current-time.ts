"use client";

import { useEffect, useState } from "react";

/** Refresh time-based labels while a page stays open; dispose the timer on exit. */
export function useCurrentTime(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
