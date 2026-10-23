---
'@gigadrive/network-config': minor
---

PHP framework presets pick their runtime from `composer.json` `require.php` instead of always using `php-84`: `php-84` when the constraint allows PHP 8.4, otherwise `php-83` when it allows PHP 8.3 (for example `~8.3.0` or `>=8.1 <8.4`). A missing or unparseable constraint, or one that allows neither, keeps `php-84`.
