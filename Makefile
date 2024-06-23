build: build-bun build-windows-x64 build-linux-x64 build-linux-arm64 build-macos-arm64 build-macos-x64

build-bun:
	bun build src/index.ts --outfile ./dist/giganet.js --target bun --minify --sourcemap

build-windows-x64:
	bun build src/index.ts --outfile ./dist/giganet.exe --compile --target=bun-windows-x64-baseline --minify --sourcemap

build-linux-x64:
	bun build src/index.ts --outfile ./dist/giganet-linux-x64 --compile --target=bun-linux-x64-baseline --minify --sourcemap

build-linux-arm64:
	bun build src/index.ts --outfile ./dist/giganet-linux-arm64 --compile --target=bun-linux-arm64 --minify --sourcemap

build-macos-arm64:
	bun build src/index.ts --outfile ./dist/giganet-macOS-arm64 --compile --target=bun-darwin-arm64 --minify --sourcemap

build-macos-x64:
	bun build src/index.ts --outfile ./dist/giganet-macOS-x64 --compile --target=bun-darwin-x64 --minify --sourcemap

test:
	bun test
