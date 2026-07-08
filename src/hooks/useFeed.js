import { useState, useEffect } from "react";
import { fetchFeed, ApiError } from "../utils/api.js";
import { captureError } from "../utils/logger.js";

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
        const json = await fetchFeed();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          const errorMessage = e instanceof ApiError
            ? e.message
            : "Error al cargar el contenido";
          setError(errorMessage);
          captureError(e, 'in useFeed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [retry]);

  const retryFetch = () => setRetry(r => r + 1);

  return { data, loading, error, retryFetch };
}
