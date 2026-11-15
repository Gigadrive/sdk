---
'@gigadrive/network-config': minor
---

Keep the Next.js integration when a project also has a config file. Merging a `gigadrive.yaml` with the detected Next.js build dropped the framework metadata, image policy and shared artifacts, so any config file silently turned off Next.js routing, prerendering and image optimization. They are now kept as long as the config file declares no functions of its own. The config file's routes run before the Next.js server's catch-all, its environment variables and regions still apply, and its `images` policy wins when set. Declaring functions still turns the integration off, now with a build warning saying so, and `assets` declared next to a kept Next.js build are ignored with a warning. A config file's `images` policy is now also kept next to frameworks without one.
