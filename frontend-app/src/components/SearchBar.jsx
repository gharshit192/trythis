import Icon from './Icon';

// Tappable placeholder by default (opens the search screen); pass `value`/`onChange`
// to make it a live input.
export default function SearchBar({ placeholder = 'Search', onClick, value, onChange, autoFocus, style }) {
  return (
    <div className="wt-search" onClick={onClick} style={style}>
      <Icon name="search" size={18} stroke={1.9} />
      {onChange
        ? <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
        : <span>{placeholder}</span>}
    </div>
  );
}
