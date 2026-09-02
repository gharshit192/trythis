// Filter chip (Explore, Saved) or selectable interest chip (`select` + `dot`).
export default function Chip({ children, on, onClick, small, select, dot }) {
  const cls = ['wt-chip', small && 'sm', select && 'select', on && 'is-on'].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} onClick={onClick} aria-pressed={!!on}>
      {dot && <span className="dot" style={{ '--dot': dot }} />}
      {children}
    </button>
  );
}
