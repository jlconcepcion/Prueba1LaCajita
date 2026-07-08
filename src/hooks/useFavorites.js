import { useState, useCallback } from "react";
import { getFromStorage, setInStorage } from "../utils/storage.js";

export function useFavorites() {
  const [favIds, setFavIds] = useState(() => {
    const stored = getFromStorage("favs", null);
    return stored ? new Set(stored) : new Set();
  });

  const [favItems, setFavItems] = useState(() => {
    return getFromStorage("fav_items", []);
  });

  const toggleFavorite = useCallback((item) => {
    if (!item || typeof item.id === 'undefined') return;

    setFavIds(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        setFavItems(fi => {
          const updated = fi.filter(f => f.id !== item.id);
          setInStorage("fav_items", updated);
          return updated;
        });
      } else {
        next.add(item.id);
        setFavItems(fi => {
          const updated = [...fi, item];
          setInStorage("fav_items", updated);
          return updated;
        });
      }
      setInStorage("favs", [...next]);
      return next;
    });
  }, []);

  return { favIds, favItems, toggleFavorite };
}
