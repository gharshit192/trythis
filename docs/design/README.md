# Design

The canonical UI design for `frontend-app/`, decided 2026-09-02. Read
[`docs/design-system.md`](../design-system.md) for tokens and primitives and
[ADR 0013](../adr/0013-text-first-ui-no-thumbnails.md) and
[ADR 0024](../adr/0024-photo-when-we-have-one.md) for the reasoning.

- **`wanna-try-redesign.pdf`** — all 36 screens at phone size, one per page, in
  six rows:
  1. **First ten minutes** — welcome, city, interests, taste, import, reading
     reels, your list
  2. **The app** — home, home with nothing saved, explore, search, item, place,
     saved, saved on a map, collections
  3. **Capture** — multi-place reel, screenshots, saved/why this one,
     saved/one question, did you go, tried it
  4. **Bringing it back** — notifications, near you now, remind me, a day from
     your saves, travel save, new trip, day-wise plan
  5. **Voice, asking, what we learned** — voice capture, voice document, ask,
     your taste, your 2026, you
  6. **When it does not work** — error states
- **`screens/*.dc.html`** — the source of each screen. Plain HTML with inline
  styles; open any file in a browser to see it at 390×844.
- **`screens/canvas.json`** — page order and the sticky-note annotations.
- **`screens/build-pdf.py`** — regenerates the PDF from the sources:
  `python3 docs/design/screens/build-pdf.py docs/design/screens print.html docs/design/wanna-try-redesign.pdf`
  (needs Google Chrome on the path).

Image blocks in the screens are placeholders for real photos, shown only
where a save would actually have one (ADR 0024). Copy is sample
Delhi content shaped like what the extraction pipeline actually produces.
