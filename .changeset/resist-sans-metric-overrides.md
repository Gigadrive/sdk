---
'@gigadrive/harmony': patch
---

Fix Resist Sans vertical metrics. Two problems, one fix.

The font ships `hhea`/OS-2-typo metrics (asc 756, desc -244) that disagree with its
`usWinAscent`/`usWinDescent` (1190/301) without `USE_TYPO_METRICS` set, so macOS/iOS and
Windows put the baseline in different places inside an identically sized line box —
Windows sat ~0.19em lower.

Separately, its ascent is unusually low (0.756) with the breathing room in `lineGap`
instead, so `ascent - descent` (0.512) fell well short of its cap height (0.695). Since
`align-items: center` centres the line box, centred text sat ~0.09em — about 1px at 12px
— high in every component. Well-built fonts avoid this: Arial is within 0.005em.

Every `Resist Sans Text` `@font-face` now declares `ascent-override: 96%`,
`descent-override: 26.5%`, `line-gap-override: 0%`. The difference equals the cap height,
so both problems go away and centred text needs no per-component padding correction.

Note this shifts text on macOS/iOS as well as Windows.
