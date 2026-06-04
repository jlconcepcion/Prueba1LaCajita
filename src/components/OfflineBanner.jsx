export default function OfflineBanner({ isOnline }) {
  if (isOnline) return null;
  return (
    <div className="offline-banner" role="alert" aria-live="assertive">
      <span>📡</span>
      <span>Sin conexión — verifica tu internet</span>
    </div>
  );
}
