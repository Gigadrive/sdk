#!/usr/bin/env bash
set -euo pipefail

if [ -f .gigadrive-next-e2e.log ]; then
  cat .gigadrive-next-e2e.log
else
  echo "BUILD_ID: unknown"
  echo "DEPLOYMENT_ID: unknown"
  echo "IMMUTABLE_ASSET_TOKEN: undefined"
fi
