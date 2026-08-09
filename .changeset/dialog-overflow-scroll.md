---
'@gigadrive/harmony': patch
---

Fix Dialog and AlertDialog clipping tall content by constraining max height to the viewport and enabling vertical scrolling. Also suppress the native focus outline on dialog content (Radix focuses it on open), which appeared as a harsh black border.
