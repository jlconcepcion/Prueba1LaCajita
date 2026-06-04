import { useState, useEffect, useRef, useCallback, memo } from "react";
import Hls from "hls.js";
import "./IPTVPlayer_1.css";
import appLogo from "./images/app-icon.png";

// ─── Config ────────────────────────────────────────────────────────────────
const API_BASE = "https://tvappbuilder.com/API/V1/embed";
const APP_ID   = 141;

// ─── Helpers ───────────────────────────────────────────────────────────────
function fmtDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h} hr${h > 1 ? 's' : ''} ${min > 0 ? min + ' min ' : ''}left`;
  }
  return `${m} mins left`;
}

// ─── PlaybackArea ──────────────────────────────────────────────────────────
function PlaybackArea({ item }) {
  const videoRef    = useRef(null);
  const wrapperRef  = useRef(null);
  const [epSrc, setEpSrc]         = useState(null);
  const [epEmbed, setEpEmbed]     = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setEpSrc(null);
    setEpEmbed(null);
    if (item.is_series && item.selectedEpisode) {
      setEpSrc(item.selectedEpisode.stream_url || item.selectedEpisode.file_url);
      setEpEmbed(item.selectedEpisode.embed_url);
    }
  }, [item]);

  const src   = item.is_series ? epSrc   : (item.stream_url || item.file_url);
  const embed = item.is_series ? epEmbed : item.embed_url;

  // ── HLS setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!src) return;
    const video = videoRef.current;
    if (!video) return;
    if (Hls.isSupported() && src.includes(".m3u8")) {
      const hls = new Hls({ maxBufferLength: 10, maxMaxBufferLength: 20 });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else {
      video.src = src;
    }
  }, [src]);

  // ── Fullscreen change listener ────────────────────────────────────────────
  useEffect(() => {
    const onFSChange = () => {
      const inFS = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );
      setIsFullscreen(inFS);
      if (inFS) {
        // Lock landscape when entering fullscreen
        if (screen.orientation?.lock) {
          screen.orientation.lock("landscape").catch(() =>
            screen.orientation.lock("landscape-primary").catch(() => {})
          );
        }
      } else {
        // Unlock orientation when leaving fullscreen
        if (screen.orientation?.unlock) screen.orientation.unlock();
      }
    };
    document.addEventListener("fullscreenchange", onFSChange);
    document.addEventListener("webkitfullscreenchange", onFSChange);
    document.addEventListener("mozfullscreenchange", onFSChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFSChange);
      document.removeEventListener("webkitfullscreenchange", onFSChange);
      document.removeEventListener("mozfullscreenchange", onFSChange);
    };
  }, []);

  // ── Physical rotation → auto fullscreen ──────────────────────────────────
  // Only auto-fullscreen for native <video> content (src without embed).
  // Iframe/embed live TV players handle fullscreen internally; requesting it
  // on the wrapper div causes the WebView to show a native overlay with a
  // close button that blocks the video.
  useEffect(() => {
    const onOrientationChange = () => {
      const angle = screen.orientation?.angle ?? window.orientation ?? 0;
      const isLandscape = angle === 90 || angle === -90 || angle === 270;
      if (isLandscape && src && !embed && videoRef.current && !document.fullscreenElement) {
        const el = wrapperRef.current || videoRef.current;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
        if (req) req.call(el).catch(() => {});
      }
    };
    window.addEventListener("orientationchange", onOrientationChange);
    screen.orientation?.addEventListener("change", onOrientationChange);
    return () => {
      window.removeEventListener("orientationchange", onOrientationChange);
      screen.orientation?.removeEventListener("change", onOrientationChange);
    };
  }, [src, embed]);

  // ── Toggle fullscreen button ──────────────────────────────────────────────
  const handleFullscreen = useCallback(() => {
    if (isFullscreen) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
      if (exit) exit.call(document).catch(() => {});
    } else {
      const el  = wrapperRef.current || videoRef.current;
      if (!el) return;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
      if (req) {
        req.call(el)
          .then(() => {
            // Lock landscape on Android (with fallback)
            if (screen.orientation?.lock) {
              screen.orientation.lock("landscape").catch(() =>
                screen.orientation.lock("landscape-primary").catch(() => {})
              );
            }
          })
          .catch(() => {});
      }
    }
  }, [isFullscreen]);

  // ── Embed (iframe / raw HTML) ─────────────────────────────────────────────
  if (embed) {
    if (embed.includes("<iframe") || embed.includes("<script")) {
      return (
        <div ref={wrapperRef} style={{width: '100%', height: '100%', position: 'relative'}}>
          <div style={{width: '100%', height: '100%'}} dangerouslySetInnerHTML={{ __html: embed }} />
          <button onClick={handleFullscreen} className="fullscreen-btn" aria-label="Fullscreen">
            {isFullscreen ? "⛶" : "⛶"}
          </button>
        </div>
      );
    }
    const embedUrl = embed + (embed.includes("?") ? "&" : "?") + "autoplay=true";
    return (
      <div ref={wrapperRef} style={{width: '100%', height: '100%', position: 'relative'}}>
        <iframe
          src={embedUrl}
          style={{width: "100%", height: "100%", border: "none"}}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
        <button onClick={handleFullscreen} className="fullscreen-btn" aria-label="Fullscreen">
          {isFullscreen ? "✕" : "⛶"}
        </button>
      </div>
    );
  }

  // ── Native video ──────────────────────────────────────────────────────────
  if (src) {
    return (
      <div ref={wrapperRef} style={{width: '100%', height: '100%', position: 'relative', background: '#000'}}>
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          poster={item.thumbnail}
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
        />
        <button onClick={handleFullscreen} className="fullscreen-btn" aria-label="Pantalla completa">
          {isFullscreen ? "✕" : "⛶"}
        </button>
      </div>
    );
  }

  return <img src={item.thumbnail} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}

// ─── EPGRow ────────────────────────────────────────────────────────────────
// memo prevents re-render unless props actually change
const EPGRow = memo(function EPGRow({ item, episodes, selectedId, selectedEpisodeId, onSelect, isFav, onToggleFav }) {
  const isAct = selectedId === item.id;

  const FavBtn = (
    <button
      className={`fav-btn ${isFav ? 'active' : ''}`}
      onClick={(e) => { e.stopPropagation(); onToggleFav(item); }}
      aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
    >
      {isFav ? "❤️" : "🤍"}
    </button>
  );

  if (!item.is_series) {
    return (
      <div className="epg-row" onClick={() => onSelect(item, null)}>
        <div className="epg-row-logo">
          <img src={item.thumbnail} alt="channel" onError={(e) => e.target.style.display='none'} loading="lazy" />
        </div>
        <div className="epg-row-programs">
          <div className={`epg-program ${isAct ? 'active' : ''}`} style={{ flexShrink: 0 }}>
            <span className="epg-program-time">
              {item.duration ? fmtDuration(item.duration) : "En Vivo"}
            </span>
            <span className="epg-program-title">{item.title}</span>
          </div>
        </div>
        {FavBtn}
      </div>
    );
  }

  // Series row — episodes are loaded by the parent, passed via prop
  return (
    <div className="epg-row">
      <div className="epg-row-logo" onClick={() => onSelect(item, episodes?.[0] || null)}>
        <img src={item.thumbnail} alt="channel" onError={(e) => e.target.style.display='none'} loading="lazy" />
      </div>
      <div className="epg-row-programs">
        {!episodes || episodes.length === 0 ? (
          <div
            className={`epg-program ${isAct && !selectedEpisodeId ? 'active' : ''}`}
            onClick={() => onSelect(item, null)}
            style={{ flexShrink: 0 }}
          >
            <span className="epg-program-time">{isAct ? "Cargando..." : "Ver serie"}</span>
            <span className="epg-program-title">{item.title}</span>
          </div>
        ) : (
          episodes.map((ep, idx) => {
            const epIsAct = isAct && selectedEpisodeId === ep.id;
            return (
              <div
                key={ep.id}
                className={`epg-program ${epIsAct ? 'active' : ''}`}
                onClick={() => onSelect(item, ep)}
                style={{ flexShrink: 0, width: '160px', flexGrow: 0 }}
              >
                <span className="epg-program-time">Episodio {ep.episode_number || idx + 1}</span>
                <span className="epg-program-title">{ep.title}</span>
              </div>
            );
          })
        )}
      </div>
      {FavBtn}
    </div>
  );
});

// ─── Main ──────────────────────────────────────────────────────────────────
export default function LaCajitaTV() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [selected, setSelected]   = useState(null);

  // ── Favorites (persisted in localStorage) ────────────────────────────────
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

  // Cache of episodes per series id: Map<series_id, episode[]>
  const episodeCache = useRef(new Map());
  // Episodes for currently visible rows (only loaded on-demand)
  const [rowEpisodes, setRowEpisodes] = useState({});

  // ── Fetch main feed on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res  = await fetch(`${API_BASE}/feed.php?church=${APP_ID}&include_live=true`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error("API returned success: false");
        if (cancelled) return;
        setData(json);
        const firstCat = json.categories?.[0]?.name;
        setActiveTab(firstCat || "Favoritos");
        setSelected(json.heroContent || json.liveFeed || json.categories?.[0]?.content?.[0] || null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Load episodes on demand (only when a series is selected) ─────────────
  const loadEpisodes = useCallback(async (seriesId) => {
    if (!seriesId) return [];
    if (episodeCache.current.has(seriesId)) {
      return episodeCache.current.get(seriesId);
    }
    try {
      const res  = await fetch(`${API_BASE}/episodes.php?series_id=${seriesId}`);
      const data = await res.json();
      const eps  = (data.success && data.episodes) ? data.episodes : [];
      episodeCache.current.set(seriesId, eps);
      return eps;
    } catch {
      return [];
    }
  }, []);

  // ── Handle item selection ─────────────────────────────────────────────────
  const handleSelect = useCallback(async (item, ep) => {
    if (item.is_series && !ep) {
      // Load episodes on demand if not cached yet
      const eps = await loadEpisodes(item.id);
      setRowEpisodes(prev => ({ ...prev, [item.id]: eps }));
      const firstEp = eps[0] || null;
      setSelected(firstEp ? { ...item, selectedEpisode: firstEp } : item);
    } else if (ep) {
      setSelected({ ...item, selectedEpisode: ep });
    } else {
      setSelected(item);
    }
  }, [loadEpisodes]);

  if (error) return (
    <div className="error-container">
      <h2>Error loading API</h2>
      <p>{error}</p>
    </div>
  );

  if (loading) return (
    <div className="loading-container">
      <div className="epg-spinner"></div>
    </div>
  );

  const tabs = data ? ["Favoritos", ...(data.categories || []).map((c) => c.name)] : [];
  const currentCategory = data?.categories?.find((c) => c.name === activeTab);
  const heroItem = selected || data?.heroContent || data?.liveFeed;
  const isFavTab = activeTab === "Favoritos";
  const listItems = isFavTab ? favItems : (currentCategory?.content || []);

  return (
    <div className="epg-app-container">

      {/* ── App Header ── */}
      <div className="epg-app-header">
        <img src={appLogo} alt="App Logo" className="epg-app-logo" />
      </div>

      {/* ── Hero Video Area ── */}
      {heroItem && (
        <div className="epg-hero">
          <PlaybackArea item={heroItem} />
          {heroItem.type === "live_feed" && (
            <>
              <div className="epg-hero-live">LIVE</div>
              <div className="epg-hero-progress">
                <div className="epg-hero-progress-inner"></div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Info Section below video ── */}
      {heroItem && (
        <div className="epg-info-bar">
          <div className="epg-info-left">
            <div className="epg-info-logo">
              <img src={heroItem.thumbnail} alt="logo" onError={(e) => e.target.style.display='none'} />
            </div>
            <div className="epg-info-text">
              <span className="epg-info-time">
                {heroItem.duration ? fmtDuration(heroItem.duration) : "En Vivo"}
              </span>
              <span className="epg-info-title">{heroItem.title}</span>
            </div>
          </div>
          <div className="epg-info-right">
            <span className="epg-icon-btn">🔗</span>
            <span className="epg-icon-btn">ⓘ</span>
          </div>
        </div>
      )}

      {/* ── Tabs (Pills) ── */}
      <div className="epg-tabs-wrapper">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`epg-tab ${activeTab === tab ? 'active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── EPG Guide / Content List ── */}
      <div className="epg-content">
        <h2 className="epg-section-title">{activeTab}</h2>

        {isFavTab && favItems.length === 0 ? (
          <div className="fav-empty">
            <span className="fav-empty-icon">🤍</span>
            <p>Aún no tienes favoritos.</p>
            <p>Toca el corazón en cualquier canal o programa para guardarlo aquí.</p>
          </div>
        ) : (
          <div className="epg-list">
            {listItems.map((item) => (
              <EPGRow
                key={item.id}
                item={item}
                episodes={rowEpisodes[item.id]}
                selectedId={selected?.id}
                selectedEpisodeId={selected?.selectedEpisode?.id}
                onSelect={handleSelect}
                isFav={favIds.has(item.id)}
                onToggleFav={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>


    </div>
  );
}
