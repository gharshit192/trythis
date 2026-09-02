# Design

The canonical UI design for `frontend-app/`, decided 2026-09-02. Read
[`docs/design-system.md`](../design-system.md) for tokens and primitives and
[ADR 0013](../adr/0013-text-first-ui-no-thumbnails.md) for the reasoning.

- **`wanna-try-redesign.pdf`** — all 17 screens at phone size, one per page.
  Rows: the first ten minutes (welcome → city → interests → import → reading
  reels → your list), the app (home, explore, item, multi-place reel, saved,
  tried), and notifications / trips / voice.
- **`screens/*.dc.html`** — the source of each screen. Plain HTML with inline
  styles; open any file in a browser to see it at 390×844.
- **`screens/canvas.json`** — page order and the sticky-note annotations.
- **`screens/build-pdf.py`** — regenerates the PDF from the sources:
  `python3 docs/design/screens/build-pdf.py docs/design/screens print.html docs/design/wanna-try-redesign.pdf`
  (needs Google Chrome on the path).

Image blocks in the screens are placeholders for real photos. Copy is sample
Delhi content shaped like what the extraction pipeline actually produces.
