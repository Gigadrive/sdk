#!/bin/bash
#make
bun run --cwd="$HOME/workspace/network/nebula/examples/next-example" $(pwd)/src/index.ts "$@"
#node dist/giganet.js --cwd="$HOME/workspace/network/nebula/packages/sveltekit-example" "$@"
