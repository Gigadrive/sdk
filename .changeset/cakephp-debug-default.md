---
'@gigadrive/network-config': patch
---

The CakePHP preset defaults `DEBUG=false`. The `config/app_local.php` that `composer install` creates from the example reads `env('DEBUG', true)`, so a deployment without the variable ran in debug mode.
