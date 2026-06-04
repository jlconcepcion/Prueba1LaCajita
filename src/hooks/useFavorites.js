import { useState, useCallback } from "react";

export function useFavorites() {
  const [favIds, setFavIds] = useState(() => {
    try {
      const raw = localStorage.getItem("lacajita_favs");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  const [favItems, setFavItems] = useState(() => {
    try {
      const raw = localStorage.getItem("lacajita_fav_items");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const toggleFavorite = useCallback((item) => {
    setFavIds(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        setFavItems(fi => {
          const updated = fi.filter(f => f.id !== item.id);
          localStorage.setItem("lacajita_fav_items", JSON.stringify(updated));
          return updated;
        });
      } else {
        next.add(item.id);
        setFavItems(fi => {
          const updated = [...fi, item];
          localStorage.setItem("lacajita_fav_items", JSON.stringify(updated));
          return updated;
        });
      }
      localStorage.setItem("lacajita_favs", JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { favIds, favItems, toggleFavorite };
}
