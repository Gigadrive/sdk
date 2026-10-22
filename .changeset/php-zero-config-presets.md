---
'@gigadrive/network-config': minor
---

Detect CakePHP, CodeIgniter, Laminas MVC, Mezzio, Slim and Yii 2, plus any other Composer project or plain PHP files, so PHP applications deploy without a config file. Each preset serves its document root as static assets, routes everything else to the front controller, and lists the directories the framework writes to at runtime in the new `package.writablePaths` function setting. Laravel and Symfony declare theirs too; Symfony drops its `var` to `/tmp` symlink, which the build rejected, and its shared placeholder `APP_SECRET`.
