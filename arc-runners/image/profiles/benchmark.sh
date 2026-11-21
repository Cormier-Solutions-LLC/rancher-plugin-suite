#!/usr/bin/env bash
set -euo pipefail

profiles=$(cd "$(dirname "$0")" && pwd)
scratch=$(mktemp -d "${RUNNER_TEMP:-/tmp}/runner-profile-benchmark.XXXXXXXX")
trap 'rm -rf -- "$scratch"' EXIT

measure() {
  local profile=$1 variant=$2
  shift 2
  local start duration
  start=$(date +%s%N)
  "$@"
  duration=$(( ($(date +%s%N) - start) / 1000000 ))
  printf '| %s | %s | %s |\n' "$profile" "$variant" "$duration" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

prepare_proofing() (
  local target=$1
  mkdir -p "$target"/{node,tools}
  curl -fsSL --retry 2 --connect-timeout 15 --max-time 180 \
    https://nodejs.org/dist/v24.22.3/node-v24.22.3-linux-x64.tar.xz -o "$target/node.tar.xz"
  printf '%s  %s\n' 4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb "$target/node.tar.xz" | sha256sum -c -
  tar -xJf "$target/node.tar.xz" --strip-components=1 -C "$target/node"
  cp "$profiles/proofing"/package*.json "$target/tools"
  PATH="$target/node/bin:$PATH" npm_config_cache="$target/npm-cache" \
    "$target/node/bin/npm" ci --prefix "$target/tools" --ignore-scripts --no-audit --no-fund
  PLAYWRIGHT_BROWSERS_PATH="$target/browsers" \
    "$target/node/bin/node" "$target/tools/node_modules/playwright/cli.js" install chromium
)

run_proofing() (
  local target=$1
  test "$("$target/node/bin/node" -p process.version)" = v24.22.3
  cd "$target/tools"
  PLAYWRIGHT_BROWSERS_PATH="$target/browsers" "$target/node/bin/node" --input-type=module <<'JS'
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<title>runner benchmark</title>');
  if (await page.title() !== 'runner benchmark') process.exitCode = 1;
} finally { await browser.close(); }
JS
)

cold_proofing() {
  prepare_proofing "$1"
  run_proofing "$1"
}

run_aot() (
  local output=$1 cache=$2
  mkdir -p "$output"
  cp "$profiles/realtimestack/RunnerAot.csproj" "$profiles/realtimestack/Program.cs" "$output"
  export NUGET_PACKAGES="$cache/packages" NUGET_HTTP_CACHE_PATH="$cache/http"
  dotnet publish "$output/RunnerAot.csproj" -c Release -o "$output/out"
  test "$("$output/out/RunnerAot")" = 'Runner Native AOT profile ready.'
)

prepare_codeql() {
  local target=$1
  mkdir -p "$target"
  curl -fsSL --retry 2 --connect-timeout 15 --max-time 480 \
    https://github.com/github/codeql-action/releases/download/codeql-bundle-v2.27.5/codeql-bundle-linux64.tar.zst -o "$target/codeql.tar.zst"
  printf '%s  %s\n' 141e6eb4e99c8498a1258e282e6f7b59c747b4b1a7eabc7cbf7d1aa92792edf0 "$target/codeql.tar.zst" | sha256sum -c -
  tar --zstd -xf "$target/codeql.tar.zst" -C "$target"
  rm "$target/codeql.tar.zst"
}

run_codeql() {
  local output=$1 cache=$2
  local cli="$cache/codeql/codeql"
  mkdir -p "$output/source"
  printf '%s\n' 'export const runnerProfile = 1;' >"$output/source/fixture.js"
  "$cli" database create "$output/db" --language=javascript-typescript --build-mode=none --threads=2 --source-root="$output/source"
  "$cli" database analyze "$output/db" --threads=2 --ram=4096 --format=sarif-latest --output="$output/results.sarif" javascript-code-scanning.qls
  jq -e 'any(.runs[]; .tool.driver.name == "CodeQL")' "$output/results.sarif" >/dev/null
}

cold_codeql() {
  prepare_codeql "$2"
  run_codeql "$@"
}

if ! command -v zstd >/dev/null; then
  sudo -n apt-get update
  sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends zstd
fi

# Materialize all three profiles before starting the timed runs.
prepare_proofing "$scratch/proofing"
run_aot "$scratch/aot-prepare" "$scratch/aot-cache"
prepare_codeql "$scratch/codeql"

printf '| Profile | Input | Elapsed ms |\n|---|---|---:|\n' >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
measure Proofing cold cold_proofing "$scratch/proof-cold-a"
measure Proofing precompiled run_proofing "$scratch/proofing"
measure Proofing precompiled run_proofing "$scratch/proofing"
measure Proofing cold cold_proofing "$scratch/proof-cold-b"
measure Native-AOT cold run_aot "$scratch/aot-cold-a" "$scratch/aot-cold-cache-a"
measure Native-AOT precompiled run_aot "$scratch/aot-warm-a" "$scratch/aot-cache"
measure Native-AOT precompiled run_aot "$scratch/aot-warm-b" "$scratch/aot-cache"
measure Native-AOT cold run_aot "$scratch/aot-cold-b" "$scratch/aot-cold-cache-b"
measure CodeQL cold cold_codeql "$scratch/codeql-out-cold" "$scratch/codeql-cold"
measure CodeQL precompiled run_codeql "$scratch/codeql-out-warm" "$scratch/codeql"
