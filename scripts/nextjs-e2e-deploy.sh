#!/usr/bin/env bash
set -euo pipefail

: "${ADAPTER_DIR:?ADAPTER_DIR is required}"
: "${GIGADRIVE_NEXT_TEST_APPLICATION_ID:?GIGADRIVE_NEXT_TEST_APPLICATION_ID is required}"

if [ "${GIGADRIVE_NEXT_TEST_ALLOW_LIVE_DEPLOYMENTS:-}" != "DEPLOY_MANY_FIXTURES" ]; then
  echo "Refusing to create live Network deployments without explicit acknowledgement" >&2
  exit 1
fi

export NEXT_ADAPTER_PATH="${ADAPTER_DIR}/packages/network-config/dist/nextjs-adapter.cjs"
pnpm install --no-frozen-lockfile >&2

# Next's isolated deploy fixtures use `typescript: latest`. Keep the stable
# compatibility run on a TypeScript release supported by Next 16; otherwise a
# newly published TypeScript major can make Next's own build worker fail before
# the adapter receives onBuildComplete.
typescript_major="$(node -e 'try { process.stdout.write(require("typescript/package.json").version.split(".")[0]) } catch { process.stdout.write("0") }')"
if [ "${typescript_major}" -eq 0 ] || [ "${typescript_major}" -ge 7 ]; then
  pnpm add --save-dev typescript@5.9.3 >&2
fi

# Next creates every deployment fixture outside the adapter checkout. Mirror the
# published package topology by placing build-time runtime modules inside the
# fixture so Turbopack can trace them without crossing its filesystem root.
adapter_runtime_dir="${PWD}/.gigadrive/adapter-runtime"
mkdir -p "${adapter_runtime_dir}"
for runtime_module in nextjs-cache-handler nextjs-cache-components-handler nextjs-image-loader; do
  install -m 0644 \
    "${ADAPTER_DIR}/packages/network-config/dist/${runtime_module}.js" \
    "${adapter_runtime_dir}/${runtime_module}.js"
done
export GIGADRIVE_NEXT_CACHE_HANDLER_PATH="${adapter_runtime_dir}/nextjs-cache-handler.js"
export GIGADRIVE_NEXT_CACHE_COMPONENTS_HANDLER_PATH="${adapter_runtime_dir}/nextjs-cache-components-handler.js"
export GIGADRIVE_NEXT_IMAGE_LOADER_PATH="${adapter_runtime_dir}/nextjs-image-loader.js"

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
