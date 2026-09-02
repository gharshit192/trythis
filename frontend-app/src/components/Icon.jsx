// Every glyph in the UI, as inline SVG on a 24px grid — one stroke style, recolours
// with `currentColor`, scales without a font. No emoji, no icon font (ADR 0013).
const PATHS = {
  // navigation + actions
  back:        'M15 18l-6-6 6-6',
  forward:     'M9 6l6 6-6 6',
  close:       'M18 6L6 18M6 6l12 12',
  plus:        'M12 5v14M5 12h14',
  check:       'M5 12.5l4.5 4.5L19 8',
  more:        'M12 5a1.4 1.4 0 1 0 .01 0M12 12a1.4 1.4 0 1 0 .01 0M12 19a1.4 1.4 0 1 0 .01 0',
  share:       'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M8 7l4-4 4 4',
  edit:        'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  search:      'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0zM20 20l-3.5-3.5',
  filter:      'M3 6h18M6 12h12M10 18h4',
  settings:    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  // tabs
  home:        'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  compass:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  bookmark:    'M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z',
  user:        'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  bell:        'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  // place + time
  pin:         'M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  locate:      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M22 12h-3M5 12H2M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  clock:       'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  calendar:    'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  trend:       'M4 14l5-5 4 4 7-7M15 6h5v5',
  // sources + media
  instagram:   'M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.5 6.5h.01',
  image:       'M6 4h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM3 15l4.5-4a2 2 0 0 1 2.7 0L15 15M15.5 9h.01',
  link:        'M10 13a4 4 0 0 0 5.7.3l3-3A4 4 0 0 0 13 5l-1.7 1.7M14 11a4 4 0 0 0-5.7-.3l-3 3A4 4 0 0 0 11 19l1.7-1.7',
  mic:         'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6',
  play:        'M7 4l12 8-12 8z',
  eye:         'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 12a2.6 2.6 0 1 0 .01 0',
  'eye-off':   'M3 3l18 18M10.6 5.9A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.1 3.9M6.6 6.7A16.8 16.8 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9.6 9.6 0 0 0 4.4-1M9.9 10a2.6 2.6 0 0 0 3.7 3.7',
  lock:        'M6 10h12a2.5 2.5 0 0 1 2.5 2.5V19a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-6.5A2.5 2.5 0 0 1 6 10zM8 10V7a4 4 0 0 1 8 0v3',
  sparkle:     'M12 3v3M12 18v3M3 12h3M18 12h3M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  folder:      'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  star:        'M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z',
  // category glyphs
  cup:         'M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM16 10h2a2 2 0 0 1 0 4h-2M7 4v2M10 4v2M13 4v2',
  bowl:        'M4 12h16a8 8 0 0 1-16 0zM8 20h8M12 4v2M8 5l1 2M16 5l-1 2',
  pot:         'M5 11h14v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM3 11h18M9 7l1-3M12 7V4M15 7l-1-3',
  bag:         'M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2',
  film:        'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM7 5v14M17 5v14M3 10h4M17 10h4M3 14h4M17 14h4',
  book:        'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  tent:        'M3 9l2-5h14l2 5M4 9v11h16V9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0',
  globe:       'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
};

export const ICON_NAMES = Object.keys(PATHS);

export default function Icon({ name, size = 20, stroke = 1.8, fill = 'none', className, style, label }) {
  const d = PATHS[name] || PATHS.bookmark;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill} stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}
    >
      <path d={d} />
    </svg>
  );
}
