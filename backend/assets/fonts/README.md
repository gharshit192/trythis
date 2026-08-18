# Bundled fonts

`NotoSansDevanagari-Regular.ttf`, `NotoSansDevanagari-Bold.ttf`

**Why these are committed rather than installed:** PDF export runs inside the
Alpine container, which ships no system fonts. pdfkit's built-in fonts
(Helvetica, Times, Courier) are the PDF base-14 set and contain **no Devanagari
glyphs at all** — Hindi rendered through them comes out as
`'ù9 •ù "™8"Ù$")?'i?'B8")"9"`, which is what every Hindi export produced before
these were added. The font has to travel with the code.

Latin text still uses Helvetica: Noto Sans Devanagari has no Latin letters
(verified — `ABCabc` are absent from its 954 glyphs), so mixed text is split into
per-script runs. See `src/utils/pdfFonts.js`.

**Licence:** SIL Open Font License 1.1, which permits redistribution and
bundling. Source: https://github.com/notofonts/devanagari
