import { useState, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;

export function useEpisodes() {
  const episodeCache = useRef(new Map());
  const [rowEpisodes, setRowEpisodes] = useState({});

  const loadEpisodes = useCallback(async (seriesId) => {
    if (!seriesId) return [];
    if (episodeCache.current.has(seriesId)) {
      return episodeCache.current.get(seriesId);
    }
    try {
      const res  = await fetch(`${API_BASE}/episodes.php?series_id=${seriesId}`);
      const data = await res.json();
      const raw  = (data.success && data.episodes) ? data.episodes : [];
      const eps  = [...raw].sort((a, b) => (b.episode_number ?? 0) - (a.episode_number ?? 0));
      episodeCache.current.set(seriesId, eps);
      return eps;
    } catch {
      return [];
    }
  }, []);

  const loadAndStore = useCallback(async (seriesId) => {
    const eps = await loadEpisodes(seriesId);
    setRowEpisodes(prev => ({ ...prev, [seriesId]: eps }));
    return eps;
  }, [loadEpisodes]);

  return { rowEpisodes, loadEpisodes, loadAndStore };
}
