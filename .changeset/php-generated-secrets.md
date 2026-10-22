---
'@gigadrive/network-config': minor
---

Laravel, Symfony and CakePHP presets ask the platform for their application secret (`APP_KEY`, `APP_SECRET`, `SECURITY_SALT`) through the new `generatedSecret()` placeholder, which Gigadrive Network resolves per environment when a function starts. Laravel also defaults `CACHE_STORE=file` and `QUEUE_CONNECTION=sync`, since the skeleton's `database` defaults need a migrated database.
