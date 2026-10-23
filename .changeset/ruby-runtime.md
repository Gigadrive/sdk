---
'@gigadrive/network-config': minor
---

Add first-class Ruby support.

- New runtimes `ruby-40`, `ruby-34` and `ruby-33`, accepted by the v4 config schema. Functions on a Ruby runtime stream responses by default.
- Framework detection gains the `ruby` language and the `bundler` package manager. Gems are read from `Gemfile.lock` (including transitive gems) or, without a lockfile, from the `Gemfile`. A detected Ruby framework always installs with `bundle install`; a Node framework never installs with Bundler because of a stray Gemfile.
- New presets: Ruby on Rails (`rails`), Hanami (`hanami`), Sinatra (`sinatra`), Roda (`roda`) and a generic Rack preset (`rack`) run `config.ru` (or a classic Sinatra script) behind a streaming catch-all route and publish `public/` as static assets. Jekyll (`jekyll`) and Bridgetown (`bridgetown`) build static sites. Rails generates `SECRET_KEY_BASE` and precompiles assets when the app uses Propshaft or Sprockets.
- Ruby presets pick their runtime from `.ruby-version`, `.tool-versions`, the Gemfile `ruby` directive or the `Gemfile.lock` `RUBY VERSION`, defaulting to `ruby-34` (`DEFAULT_RUBY_RUNTIME`). The pure, synchronous `rubyRuntimeFromProjectFiles(readFile)` applies the same rules to file contents the caller supplies, so a build can pick its Ruby exactly as the presets do; `detectRubyRuntime()` runs it over the Effect file system.
- Static assets of a Ruby project never include dotfiles, Ruby sources, Bundler files or the `vendor/` directory.
