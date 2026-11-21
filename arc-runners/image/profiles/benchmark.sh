#!/usr/bin/env bash
set -euo pipefail

context=$(cd "$(dirname "$0")/.." && pwd)
base=harbor.cormierconsulting.io/automation/arc-runner-linux@sha256:cacbd0adafb78ff675e72217e704f064664c04b9bb5fccc5887f17ab436fb835
export DOCKER_BUILDKIT=1
for profile in proofing realtimestack codeql-os codeql; do
  docker build --target "$profile" -f "$context/Dockerfile.profiles" -t "runner-benchmark:$profile" "$context"
done

measure() {
  local profile=$1 variant=$2
  shift 2
  local start duration
  start=$(date +%s%N)
  "$@"
  duration=$(( ($(date +%s%N) - start) / 1000000 ))
  printf '| %s | %s | %s |\n' "$profile" "$variant" "$duration" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

proofing() {
  local image=$1 mode=$2
  docker run --rm --entrypoint bash \
    --mount "type=bind,source=$context/profiles/proofing,target=/fixture,readonly" \
    "$image" -euc '
    if [[ "$1" == cold ]]; then
      node_version=24.22.3
      curl --fail --silent --show-error --location --retry 2 \
        "https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-x64.tar.xz" -o /tmp/node.tar.xz
      printf "%s  %s\n" 4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb /tmp/node.tar.xz | sha256sum -c -
      mkdir /tmp/node /tmp/proofing
      tar -xJf /tmp/node.tar.xz --strip-components=1 -C /tmp/node
      export PATH=/tmp/node/bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/tmp/browser-cold
      cp /fixture/package*.json /tmp/proofing/
      npm ci --prefix /tmp/proofing --ignore-scripts --no-audit --no-fund
      /tmp/proofing/node_modules/.bin/playwright install chromium
      cd /tmp/proofing
    else
      export PATH=/opt/hostedtoolcache/node/24.22.3/x64/bin:$PATH
      cd /opt/proofing-tools
    fi
    test "$(node -p process.version)" = v24.22.3
    node --input-type=module -e '\''
      import { chromium } from "playwright";
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.setContent("<title>runner benchmark</title>");
        if (await page.title() !== "runner benchmark") process.exitCode = 1;
      } finally { await browser.close(); }
    '\''
  ' -- "$mode"
}

aot() {
  docker run --rm --entrypoint bash \
    --mount "type=bind,source=$context/profiles/realtimestack,target=/fixture,readonly" \
    "$1" -euc '
    mkdir /tmp/bench
    cp /fixture/RunnerAot.csproj /fixture/Program.cs /tmp/bench/
    dotnet publish /tmp/bench/RunnerAot.csproj -c Release -o /tmp/bench/out
    test "$(/tmp/bench/out/RunnerAot)" = "Runner Native AOT profile ready."
  '
}

codeql() {
  local image=$1 mode=$2
  docker run --rm --memory 8g --entrypoint bash "$image" -euc '
    cli=/opt/hostedtoolcache/CodeQL/2.27.5/x64/codeql/codeql
    if [[ "$1" == cold ]]; then
      curl --fail --silent --show-error --location --retry 2 \
        https://github.com/github/codeql-action/releases/download/codeql-bundle-v2.27.5/codeql-bundle-linux64.tar.zst -o /tmp/codeql.tar.zst
      printf "%s  %s\n" 141e6eb4e99c8498a1258e282e6f7b59c747b4b1a7eabc7cbf7d1aa92792edf0 /tmp/codeql.tar.zst | sha256sum -c -
      tar --zstd -xf /tmp/codeql.tar.zst -C /tmp
      cli=/tmp/codeql/codeql
    fi
    mkdir /tmp/codeql-input
    printf "%s\n" "export const runnerProfile = 1;" >/tmp/codeql-input/fixture.js
    "$cli" database create /tmp/runner-codeql-db --language=javascript-typescript --build-mode=none --threads=2 --source-root=/tmp/codeql-input
    "$cli" database analyze /tmp/runner-codeql-db --threads=2 --ram=4096 --format=sarif-latest --output=/tmp/runner-codeql.sarif javascript-code-scanning.qls
    jq -e "any(.runs[]; .tool.driver.name == \"CodeQL\")" /tmp/runner-codeql.sarif >/dev/null
  ' -- "$mode"
}

printf '| Profile | Input | Elapsed ms |\n|---|---|---:|\n' >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
docker pull "$base"
measure Proofing cold proofing "$base" cold
measure Proofing precompiled proofing runner-benchmark:proofing precompiled
measure Proofing precompiled proofing runner-benchmark:proofing precompiled
measure Proofing cold proofing "$base" cold
measure Native-AOT cold aot "$base"
measure Native-AOT precompiled aot runner-benchmark:realtimestack
measure Native-AOT precompiled aot runner-benchmark:realtimestack
measure Native-AOT cold aot "$base"
measure CodeQL cold codeql runner-benchmark:codeql-os cold
measure CodeQL precompiled codeql runner-benchmark:codeql precompiled
measure CodeQL precompiled codeql runner-benchmark:codeql precompiled
measure CodeQL cold codeql runner-benchmark:codeql-os cold
