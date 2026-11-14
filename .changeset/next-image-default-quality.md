---
'@gigadrive/network-config': patch
---

Encode Next.js images at quality 75 by default, like Next.js itself. The image loader sent no quality when an image set none, so the optimizer used its own higher default and images were about 40% larger than on Vercel. The quality is now the requested one or 75, snapped to the closest value in `images.qualities` when the app restricts them.
