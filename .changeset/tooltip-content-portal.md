---
'@gigadrive/harmony': patch
---

Render `TooltipContent` inside a Radix portal so tooltips no longer inherit text alignment from their trigger's ancestors or get clipped by `overflow` containers. This matches every other floating Harmony component (popover, dropdown, select, dialog).
