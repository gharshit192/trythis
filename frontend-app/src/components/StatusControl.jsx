// Want to try · Planning · Tried it — bound to Save.intentStatus (ADR 0015).
// `dismissed` is a swipe action elsewhere, never a segment.
const SEGMENTS = [
  { value: 'saved',   label: 'Want to try' },
  { value: 'planned', label: 'Planning' },
  { value: 'tried',   label: 'Tried it' },
];

export default function StatusControl({ value = 'saved', onChange, disabled }) {
  return (
    <div className="wt-status" role="radiogroup" aria-label="Status">
      {SEGMENTS.map((s) => (
        <button
          key={s.value} type="button" role="radio" aria-checked={value === s.value}
          className={value === s.value ? 'is-on' : ''}
          disabled={disabled}
          onClick={() => value !== s.value && onChange?.(s.value)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
