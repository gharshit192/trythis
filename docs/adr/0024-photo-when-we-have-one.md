# ADR 0024: A Photo When We Have One, Text When We Don't

Status: Accepted - 2026-09-10
Amends: [ADR 0013](0013-text-first-ui-no-thumbnails.md)

## Decision

A save's card shows its photo when extraction returned a usable one, and falls
back to the existing text-first row when it did not. The layout does not change
between the two states: the 44x44 leading tile is either the category icon or
the photo. On the item screen a photo becomes a 92px hero above the title;
without one the screen reads exactly as it did before.

ADR 0013 removed thumbnails because a broken, expired or missing image looks
worse than no image, and because a wall of reel stills makes the product read as
another feed to scroll. Both hold. What ADR 0013 over-corrected is the case
where a good photo exists: refusing to show it does not protect the user from
anything.

Mobile PRD §19 and §20 assume image-led cards throughout. That is rejected. This
is the middle position: the PRD's appeal where the data supports it, ADR 0013's
protection everywhere else.

## Rules

The photo renders only when the save actually holds one that resolves. A missing,
expired or failed image is never a broken frame, a spinner or a grey box with an
icon — the row falls back to the category tile and reads as a complete design,
not a degraded one. Lists never become a grid of images: one leading tile per
row, same size as the icon it replaces, so scan-ability and row rhythm are
unchanged.

Instagram thumbnail URLs expire. The cached copy is the source, never the
remote URL, and a cache miss is a fallback, not a fetch on render.

## Consequences

The "no thumbnails" claim in `docs/design/README.md` and the canvas annotation
are no longer accurate and have been updated. Screens carrying the change:
`Main`, `Saved` and `Detail`. `Explore`, `MultiExtract` and `Trip` inherit the
same rule when their rows are next touched.

This does not reopen the feed question. The product still does not scroll images
for their own sake; ADR 0013's reasoning about not becoming a reel app stands
unchanged.
