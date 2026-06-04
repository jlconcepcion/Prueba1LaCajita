export default function SkeletonLoader() {
  return (
    <div className="skeleton-wrapper" aria-busy="true" aria-label="Cargando contenido">
      {/* Hero skeleton */}
      <div className="skeleton-hero" />

      {/* Info bar skeleton */}
      <div className="skeleton-info-bar">
        <div className="skeleton-circle" />
        <div className="skeleton-lines">
          <div className="skeleton-line short" />
          <div className="skeleton-line medium" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="skeleton-tabs">
        {[80, 100, 70, 90].map((w, i) => (
          <div key={i} className="skeleton-tab" style={{ width: w }} />
        ))}
      </div>

      {/* List skeleton */}
      <div className="skeleton-list">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton-logo" />
            <div className="skeleton-program">
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
