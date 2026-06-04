import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;
const APP_ID   = import.meta.env.VITE_APP_ID;

export function useFeed() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [retry, setRetry]     = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res  = await fetch(`${API_BASE}/feed.php?church=${APP_ID}&include_live=true`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error("API returned success: false");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [retry]);

  const retryFetch = () => setRetry(r => r + 1);

  return { data, loading, error, retryFetch };
}
