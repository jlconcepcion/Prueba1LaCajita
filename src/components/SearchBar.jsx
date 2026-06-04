export default function SearchBar({ value, onChange }) {
  return (
    <div className="search-bar-wrapper">
      <span className="search-icon" aria-hidden="true">🔍</span>
      <input
        id="search-input"
        type="search"
        className="search-input"
        placeholder="Buscar canales o programas..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Buscar contenido"
      />
      {value && (
        <button
          className="search-clear"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
        >
          ✕
        </button>
      )}
    </div>
  );
}
