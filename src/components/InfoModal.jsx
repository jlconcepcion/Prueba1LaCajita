export default function InfoModal({ item, onClose }) {
  if (!item) return null;

  const isLive   = item.type === "live_feed" || (!item.is_series && !item.duration);
  const isSeries = item.is_series;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Información del contenido">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>

        <div className="modal-header">
          {item.thumbnail && (
            <img src={item.thumbnail} alt={item.title} className="modal-thumb" />
          )}
          <div className="modal-meta">
            <span className={`badge ${isLive ? 'badge-live' : isSeries ? 'badge-series' : 'badge-vod'}`}>
              {isLive ? 'EN VIVO' : isSeries ? 'SERIE' : 'VOD'}
            </span>
            <h2 className="modal-title">{item.title}</h2>
          </div>
        </div>

        {item.description && (
          <p className="modal-description">{item.description}</p>
        )}

        {item.category && (
          <div className="modal-detail">
            <span className="modal-detail-label">Categoría</span>
            <span className="modal-detail-value">{item.category}</span>
          </div>
        )}

        {item.duration && (
          <div className="modal-detail">
            <span className="modal-detail-label">Duración</span>
            <span className="modal-detail-value">{Math.floor(item.duration / 60)} min</span>
          </div>
        )}

        <button className="modal-play-btn" onClick={onClose} aria-label="Reproducir">
          ▶ Reproducir
        </button>
      </div>
    </div>
  );
}
