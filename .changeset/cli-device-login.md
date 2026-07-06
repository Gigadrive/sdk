---
'gigadrive': minor
---

Replace the CLI login's local callback server with the OAuth 2.0 Device Authorization Grant (RFC 8628).

`gigadrive login` no longer starts a local HTTP server or binds an ephemeral port to catch a
browser redirect. Instead it requests a device/user code, opens your browser to the verification
page (with the code prefilled), and polls for approval — so login now works cleanly over SSH, in
containers, and other headless environments. When run in a TTY the browser opens automatically and
you can press `c` to copy the verification URL; in a non-interactive shell it prints the URL and
code and polls without a browser.
