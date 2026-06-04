import { useState, useEffect, useRef, useCallback } from "react";
import { App as CapApp } from "@capacitor/app";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

import PlaybackArea  from "./components/PlaybackArea";
import EPGRow        from "./components/EPGRow";
import SearchBar     from "./components/SearchBar";
import InfoModal     from "./components/InfoModal";
import SkeletonLoader from "./components/SkeletonLoader";
import OfflineBanner from "./components/OfflineBanner";

import { useFeed }       from "./hooks/useFeed";
import { useFavorites }  from "./hooks/useFavorites";
import { useEpisodes }   from "./hooks/useEpisodes";

import "./App.css";
import appLogo from "../images/app-icon.png";

export default function LaCajitaTV() {
  const { data, loading, error, retryFetch } = useFeed();
  const { favIds, favItems, toggleFavorite }  = useFavorites();
  const { rowEpisodes, loadAndStore }          = useEpisodes();

  const [activeTab, setActiveTab]   = useState(null);
  const [selected, setSelected]     = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isOnline, setIsOnline]     = useState(navigator.onLine);

  // ── Online/offline detection ────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── Android back button ─────────────────────────────────────────────────
  // Refs keep the listener callback up-to-date without re-registering it.
  // Re-registering on every state change stacks multiple listeners and creates
  // a race condition where handler is undefined at cleanup → app closes instead
  // of being minimized.
  const showModalRef   = useRef(showModal);
  const searchQueryRef = useRef(searchQuery);
  // Ref que congela 'selected' en el momento exacto en que termina un episodio.
  // Evita race condition: si el usuario cambia de contenido justo cuando el video
  // dispara 'ended', el auto-advance NO se aplica a la nueva selección.
  const selectedRef    = useRef(selected);
  useEffect(() => { showModalRef.current   = showModal;   }, [showModal]);
  useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);
  useEffect(() => { selectedRef.current    = selected;    }, [selected]);

  useEffect(() => {
    let handle = null;
    CapApp.addListener("backButton", () => {
      if (showModalRef.current)   { setShowModal(false);  return; }
      if (searchQueryRef.current) { setSearchQuery("");   return; }
      CapApp.minimizeApp();
    })
      .then(h  => { handle = h; })
      .catch(() => {}); // Not running in Capacitor (browser preview) — ignore
    return () => { handle?.remove(); };
  }, []); // ← empty: register ONCE, never re-register

  // ── Sync first tab & hero after data loads ──────────────────────────────
  useEffect(() => {
    if (!data) return;
    const firstCat = data.categories?.[0]?.name;
    setActiveTab(firstCat || "Favoritos");
    setSelected(data.heroContent || data.liveFeed || data.categories?.[0]?.content?.[0] || null);
  }, [data]);

  // ── Reset video progress on item change ────────────────────────────────
  useEffect(() => { setVideoProgress(0); }, [selected]);

  // ── Handle item selection ───────────────────────────────────────────────
  const handleSelect = useCallback(async (item, ep) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    if (item.is_series && !ep) {
      const eps = await loadAndStore(item.id);
      const firstEp = eps[0] || null;
      setSelected(firstEp ? { ...item, selectedEpisode: firstEp } : item);
    } else if (ep) {
      setSelected({ ...item, selectedEpisode: ep });
    } else {
      setSelected(item);
    }
  }, [loadAndStore]);

  // ── Auto-play next episode on video end (loop) ─────────────────────────
  // Episodios ordenados desc (más reciente = índice 0, más antiguo = último).
  // Al terminar el último episodio, % eps.length regresa al índice 0 (loop).
  //
  // Usa selectedRef (snapshot en el momento del evento 'ended') para protegerse
  // de race condition: si el usuario ya cambió de contenido antes de que el
  // evento disparara, el auto-advance se descarta y no interrumpe la nueva selección.
  const handleEpisodeEnded = useCallback(() => {
    const snap = selectedRef.current;           // estado exacto al momento de 'ended'
    if (!snap?.is_series) return;               // no es serie → ignorar

    const eps = rowEpisodes[snap.id];
    if (!eps || eps.length === 0) return;

    // Guard: si el usuario ya cambió a otro contenido, descartar el evento
    if (selected?.id !== snap.id) return;

    const currentIdx = eps.findIndex(ep => ep.id === snap.selectedEpisode?.id);
    // currentIdx === -1 → episodio no encontrado → empezar desde el más reciente (0)
    const safeIdx = currentIdx >= 0 ? currentIdx : -1;
    const nextIdx  = (safeIdx + 1) % eps.length;
    handleSelect(snap, eps[nextIdx]);
  }, [selected, rowEpisodes, handleSelect]);

  // ── Handle tab change ──────────────────────────────────────────────────
  const handleTabChange = useCallback(async (tab) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    setActiveTab(tab);
    setSearchQuery("");
  }, []);

  // ── Handle favorite toggle ─────────────────────────────────────────────
  const handleToggleFav = useCallback(async (item) => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    toggleFavorite(item);
  }, [toggleFavorite]);

  // ── Derive displayed list ───────────────────────────────────────────────
  const tabs = data ? ["Favoritos", ...(data.categories || []).map((c) => c.name)] : [];
  const isFavTab = activeTab === "Favoritos";
  const currentCategory = data?.categories?.find((c) => c.name === activeTab);
  const rawList  = isFavTab ? favItems : (currentCategory?.content || []);
  const listItems = searchQuery
    ? rawList.filter((i) => i.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : rawList;

  const heroItem   = selected || data?.heroContent || data?.liveFeed;
  const isLiveHero = heroItem?.type === "live_feed";

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) return <SkeletonLoader />;

  // ── Error state ────────────────────────────────────────────────────────
  if (error) return (
    <div className="error-container">
      <span className="error-icon">⚠️</span>
      <h2>Error al cargar</h2>
      <p>{error}</p>
      <button className="retry-btn" onClick={retryFetch}>Reintentar</button>
    </div>
  );

  return (
    <div className="epg-app-container">
      <OfflineBanner isOnline={isOnline} />

      {/* ── App Header ── */}
      <header className="epg-app-header">
        <img src={appLogo} alt="LaCajitaTV" className="epg-app-logo" />
        <div className="header-right">
          {favIds.size > 0 && (
            <span className="fav-count-badge" aria-label={`${favIds.size} favoritos`}>
              {favIds.size}
            </span>
          )}
        </div>
      </header>

      {/* ── Hero Video Area ── */}
      {heroItem && (
        <div className="epg-hero">
          <PlaybackArea
            item={heroItem}
            onProgress={setVideoProgress}
            onEnded={handleEpisodeEnded}
          />
          {isLiveHero && (
            <div className="epg-hero-live">LIVE</div>
          )}
          <div className="epg-hero-progress">
            <div
              className="epg-hero-progress-inner"
              style={{ width: isLiveHero ? "100%" : `${videoProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Info Section below video ── */}
      {heroItem && (
        <div className="epg-info-bar">
          <div className="epg-info-left">
            <div className="epg-info-logo">
              <img
                src={heroItem.thumbnail}
                alt="logo"
                width="44"
                height="44"
                onError={(e) => e.target.style.display='none'}
              />
            </div>
            <div className="epg-info-text">
              <span className="epg-info-time">
                {heroItem.duration
                  ? `${Math.floor(heroItem.duration / 60)} min`
                  : "En Vivo"}
              </span>
              <span className="epg-info-title">{heroItem.title}</span>
            </div>
          </div>
          <div className="epg-info-right">
            <button
              className={`epg-icon-btn fav-hero-btn ${heroItem && favIds.has(heroItem.id) ? 'fav-active' : ''}`}
              onClick={() => heroItem && handleToggleFav(heroItem)}
              aria-label={heroItem && favIds.has(heroItem.id) ? "Quitar de favoritos" : "Agregar a favoritos"}
            >
              {heroItem && favIds.has(heroItem.id) ? "❤️" : "🤍"}
            </button>
            <button
              className="epg-icon-btn"
              onClick={() => setShowModal(true)}
              aria-label="Información del programa"
            >
              ⓘ
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs (Pills) ── */}
      <nav className="epg-tabs-wrapper" aria-label="Categorías">
        {tabs.map((tab) => (
          <button
            key={tab}
            id={`tab-${tab.replace(/\s+/g, '-').toLowerCase()}`}
            onClick={() => handleTabChange(tab)}
            className={`epg-tab ${activeTab === tab ? 'active' : ''}`}
            aria-selected={activeTab === tab}
            role="tab"
          >
            {tab}
            {tab === "Favoritos" && favIds.size > 0 && (
              <span className="tab-count">{favIds.size}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Search Bar ── */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* ── EPG Guide / Content List ── */}
      <main className="epg-content">
        <h2 className="epg-section-title">
          {searchQuery ? `Resultados para "${searchQuery}"` : activeTab}
        </h2>

        {isFavTab && favItems.length === 0 && !searchQuery ? (
          <div className="fav-empty">
            <span className="fav-empty-icon">🤍</span>
            <p>Aún no tienes favoritos.</p>
            <p>Toca el corazón en cualquier canal o programa para guardarlo aquí.</p>
          </div>
        ) : listItems.length === 0 ? (
          <div className="fav-empty">
            <span className="fav-empty-icon">🔍</span>
            <p>No se encontraron resultados para "{searchQuery}".</p>
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
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Info Modal ── */}
      {showModal && heroItem && (
        <InfoModal item={heroItem} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
