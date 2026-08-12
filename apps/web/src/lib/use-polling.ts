import { useCallback, useEffect, useRef, useState } from "react";

interface PollingResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Poll a fetcher on an interval plus on window focus. Cancels in-flight updates
 * on unmount (no setState-after-unmount), and skips overlapping fetches.
 * Pass `active=false` to pause polling (e.g. a closed drawer).
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  { intervalMs = 5000, active = true }: { intervalMs?: number; active?: boolean } = {},
): PollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await fetcherRef.current();
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) {
        const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
        setError(msg ?? "Something went wrong.");
      }
    } finally {
      if (mounted.current) setLoading(false);
      inFlight.current = false;
    }
  }, []);

  // Track mount separately so pausing/resuming polling never flips it.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    void refresh();
    const timer = setInterval(() => void refresh(), intervalMs);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [active, intervalMs, refresh]);

  return { data, error, loading, refresh };
}
