// Rounded grey search affordance. On Home it's a button that opens Search;
// pass children to render an active/focused state (e.g. on the Search screen itself).
export default function SearchBar({ onClick, placeholder = 'Search your saves...', style }) {
  return (
    <button className="search-bar" onClick={onClick} style={style}>
      <span>🔍</span>
      <span className="search-bar-placeholder">{placeholder}</span>
    </button>
  );
}
