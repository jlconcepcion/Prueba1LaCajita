import { useState, useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import { sanitizeEmbed, isValidEmbedHtml } from "../utils/sanitize.js";
import { validateEmbedUrl } from "../utils/validation.js";
import { logger } from "../utils/logger.js";

export default function PlaybackArea({ item, onProgress, onEnded }) {
  const videoRef   = useRef(null);
  const wrapperRef = useRef(null);
  const [epSrc, setEpSrc]             = useState(null);
  const [epEmbed, setEpEmbed]         = useState(null);
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [embedFullscreen, setEmbedFullscreen] = useState(false);

  useEffect(() => {
    setEpSrc(null);
    setEpEmbed(null);
    setEmbedFullscreen(false);
    if (item.is_series && item.selectedEpisode) {
      setEpSrc(item.selectedEpisode.stream_url || item.selectedEpisode.file_url);
      setEpEmbed(item.selectedEpisode.embed_url);
    }
  }, [item]);

  const src   = item.is_series ? epSrc   : (item.stream_url || item.file_url);
  const embed = item.is_series ? epEmbed : item.embed_url;

  // Sync embedFullscreen state to document body to hide other UI elements
  useEffect(() => {
    if (embedFullscreen) {
      document.body.classList.add("embed-fullscreen-active");
    } else {
      document.body.classList.remove("embed-fullscreen-active");
    }
    return () => document.body.classList.remove("embed-fullscreen-active");
  }, [embedFullscreen]);

  // HLS setup
  useEffect(() => {
    if (!src) return;
    const video = videoRef.current;
    if (!video) return;

    const isHls = src.includes(".m3u8") || src.includes("manifest") || item.type === "live_feed" || (item.category && String(item.category).toLowerCase().includes("live"));
    let hls = null;

    if (Hls.isSupported() && isHls) {
      hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: false,
        lowLatencyMode: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(err => {
          logger.warn("Auto-play prevented by browser policy", err);
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              logger.warn("HLS network error, attempting recovery...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              logger.warn("HLS media error, attempting recovery...");
              hls.recoverMediaError();
              break;
            default:
              logger.warn("HLS unrecoverable error, switching to native video player...");
              hls.destroy();
              hls = null;
              video.src = src;
              video.play().catch(() => {});
              break;
          }
        }
      });

      return () => {
        if (hls) {
          hls.destroy();
        }
      };
    } else {
      video.src = src;
      video.play().catch(() => {});
    }
  }, [src, item]);

  // Real video progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onProgress) return;
    const handleTimeUpdate = () => {
      if (video.duration) onProgress(video.currentTime / video.duration);
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [onProgress]);

  // Fullscreen API listener
  useEffect(() => {
    const onFSChange = () => {
      const inFS = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );
      setIsFullscreen(inFS);
      if (inFS) {
        screen.orientation?.lock?.("landscape").catch(() =>
          screen.orientation?.lock?.("landscape-primary").catch(() => {})
        );
      } else {
        screen.orientation?.unlock?.();
      }
    };
    document.addEventListener("fullscreenchange",       onFSChange);
    document.addEventListener("webkitfullscreenchange", onFSChange);
    document.addEventListener("mozfullscreenchange",    onFSChange);
    return () => {
      document.removeEventListener("fullscreenchange",       onFSChange);
      document.removeEventListener("webkitfullscreenchange", onFSChange);
      document.removeEventListener("mozfullscreenchange",    onFSChange);
    };
  }, []);

  // Physical rotation handler
  useEffect(() => {
    const onOrientationChange = () => {
      const angle = screen.orientation?.angle ?? window.orientation ?? 0;
      const isLandscape = angle === 90 || angle === -90 || angle === 270;

      if (embed) {
        setEmbedFullscreen(isLandscape);
        return;
      }

      if (isLandscape && src && videoRef.current && !document.fullscreenElement) {
        const el  = videoRef.current;
        if (!el) return;
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

  // Fullscreen button
  const handleFullscreen = useCallback(() => {
    if (embed) {
      setEmbedFullscreen(!embedFullscreen);
      return;
    }
    if (isFullscreen) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
      if (exit) exit.call(document).catch(() => {});
    } else {
      const el  = videoRef.current;
      if (!el) return;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
      if (req) {
        req.call(el).then(() => {
          screen.orientation?.lock?.("landscape").catch(() =>
            screen.orientation?.lock?.("landscape-primary").catch(() => {})
          );
        }).catch(() => {});
      }
    }
  }, [isFullscreen, embed, embedFullscreen]);

  // ── Embed — raw HTML (<iframe> tag o <script>) ──────────────────────────
  // ⚠️  LIMITACIÓN: onEnded NO puede dispararse desde dentro de un <iframe>
  // (restricción cross-origin del navegador). El loop automático de episodios
  // solo funciona con el player nativo <video> (stream_url / file_url + HLS).
  // Para episodios con embed_url el usuario deberá seleccionar el siguiente
  // episodio manualmente desde la lista.
  if (embed) {
    if (isValidEmbedHtml(embed)) {
      const cleanEmbed = sanitizeEmbed(embed);

      if (!cleanEmbed) {
        logger.warn('Embed HTML failed sanitization', { original: embed.substring(0, 100) });
        return (
          <div className="embed-error" style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#fff", textAlign: "center" }}>Contenido no disponible</p>
          </div>
        );
      }

      return (
        <div
          ref={wrapperRef}
          className="embed-wrapper"
          style={{ width: "100%", height: "100%", position: "relative", background: "#000" }}
        >
          <div
            style={{ width: "100%", height: "100%" }}
            dangerouslySetInnerHTML={{ __html: cleanEmbed }}
          />
          <button onClick={handleFullscreen} className="fullscreen-btn" aria-label="Pantalla completa">
            {embedFullscreen ? "✕" : "⛶"}
          </button>
        </div>
      );
    }

    // Embed URL → iframe (with validation)
    if (!validateEmbedUrl(embed)) {
      logger.warn('Invalid embed URL', { url: embed });
      return (
        <div className="embed-error" style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#fff", textAlign: "center" }}>URL de contenido inválida</p>
        </div>
      );
    }

    const embedUrl = embed + (embed.includes("?") ? "&" : "?") + "autoplay=true";
    return (
      <div
        ref={wrapperRef}
        className="embed-wrapper"
        style={{ width: "100%", height: "100%", position: "relative", background: "#000" }}
      >
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="autoplay"
          title={item.title || "player"}
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        />
        <button onClick={handleFullscreen} className="fullscreen-btn" aria-label="Pantalla completa">
          {embedFullscreen ? "✕" : "⛶"}
        </button>
      </div>
    );
  }

  // ── Native <video>
  if (src) {
    return (
      <div ref={wrapperRef} style={{ width: "100%", height: "100%", position: "relative", background: "#000" }}>
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          onEnded={onEnded}
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
