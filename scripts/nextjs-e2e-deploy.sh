#!/usr/bin/env bash
set -euo pipefail

: "${ADAPTER_DIR:?ADAPTER_DIR is required}"
: "${GIGADRIVE_NEXT_TEST_APPLICATION_ID:?GIGADRIVE_NEXT_TEST_APPLICATION_ID is required}"

export NEXT_ADAPTER_PATH="${ADAPTER_DIR}/packages/network-config/dist/nextjs-adapter.cjs"
pnpm install --no-frozen-lockfile >&2
pnpm build >&2

build_id="$(tr -d '\n' < .next/BUILD_ID)"
deploy_log="$(mktemp)"
if ! node "${ADAPTER_DIR}/packages/cli/dist/index.mjs" platform deploy --app "${GIGADRIVE_NEXT_TEST_APPLICATION_ID}" >"${deploy_log}" 2>&1; then
  cat "${deploy_log}" >&2
  exit 1
fi

cat "${deploy_log}" >&2
deployment_id="$(sed -n 's/^Deployment ID: //p' "${deploy_log}" | tail -1)"
deployment_url="$(sed -n 's/^Deployed to //p' "${deploy_log}" | tail -1)"
if [ -z "${deployment_id}" ] || [ -z "${deployment_url}" ]; then
  echo "Gigadrive CLI did not report a deployment ID and URL" >&2
  exit 1
fi

{
  echo "BUILD_ID: ${build_id}"
  echo "DEPLOYMENT_ID: ${deployment_id}"
  echo "IMMUTABLE_ASSET_TOKEN: undefined"
  cat "${deploy_log}"
} > .gigadrive-next-e2e.log

printf '%s\n' "${deployment_url}"
