import { useState, useRef, useCallback } from "react";
import { fetchEpisodes, ApiError } from "../utils/api.js";
import { captureError } from "../utils/logger.js";

export function useEpisodes() {
  const episodeCache = useRef(new Map());
  const [rowEpisodes, setRowEpisodes] = useState({});

  const loadEpisodes = useCallback(async (seriesId) => {
    if (!seriesId) return [];
    if (episodeCache.current.has(seriesId)) {
      return episodeCache.current.get(seriesId);
    }
    try {
      const data = await fetchEpisodes(seriesId);
      const raw  = (data.success && data.episodes) ? data.episodes : [];
      const eps  = [...raw].sort((a, b) => (b.episode_number ?? 0) - (a.episode_number ?? 0));
      episodeCache.current.set(seriesId, eps);
      return eps;
    } catch (error) {
      captureError(error, `in useEpisodes for series ${seriesId}`);
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
