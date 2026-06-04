import { memo } from "react";

function fmtDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  if (m >= 60) {
    const h   = Math.floor(m / 60);
    const min = m % 60;
    return `${h} hr${h > 1 ? 's' : ''} ${min > 0 ? min + ' min ' : ''}left`;
  }
  return `${m} mins left`;
}

function ContentBadge({ item }) {
  if (item.type === "live_feed" || (!item.is_series && !item.duration)) {
    return <span className="badge badge-live">EN VIVO</span>;
  }
  if (item.is_series) {
    return <span className="badge badge-series">SERIE</span>;
  }
  return <span className="badge badge-vod">VOD</span>;
}

const EPGRow = memo(function EPGRow({ item, episodes, selectedId, selectedEpisodeId, onSelect }) {
  const isAct = selectedId === item.id;


  if (!item.is_series) {
    return (
      <div className="epg-row" onClick={() => onSelect(item, null)}>
        <div className="epg-row-logo">
          <img src={item.thumbnail} alt="channel" onError={(e) => e.target.style.display='none'} loading="lazy" width="70" height="70" />
          <ContentBadge item={item} />
        </div>
        <div className="epg-row-programs">
          <div className={`epg-program ${isAct ? 'active' : ''}`} style={{ flexShrink: 0 }}>
            <span className="epg-program-time">
              {item.duration ? fmtDuration(item.duration) : "En Vivo"}
            </span>
            <span className="epg-program-title">{item.title}</span>
          </div>
        </div>
      </div>
    );
  }

  // Series row
  return (
    <div className="epg-row">
      <div className="epg-row-logo" onClick={() => onSelect(item, episodes?.[0] || null)}>
        <img src={item.thumbnail} alt="channel" onError={(e) => e.target.style.display='none'} loading="lazy" width="70" height="70" />
        <ContentBadge item={item} />
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
    </div>
  );
});

export default EPGRow;
