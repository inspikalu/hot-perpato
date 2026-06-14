"use client";

import { useState, useEffect } from "react";
import { fetchSolPrice } from "@/lib/flash";

export function useFlashPrice(pollIntervalMs = 3000) {
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const p = await fetchSolPrice();
        if (mounted) {
          setPrice(p);
          setError(null);
        }
      } catch {
        if (mounted) {
          setError("Price fetch failed");
        }
      } finally {
        if (mounted) {
          setLoading(false);
          timeoutId = setTimeout(poll, pollIntervalMs);
        }
      }
    }

    poll();
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [pollIntervalMs]);

  return { price, loading, error };
}
