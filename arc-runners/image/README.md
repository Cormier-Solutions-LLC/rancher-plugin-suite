# Linux CI runner image

## Precompiled workload profiles

`Dockerfile.profiles` extends the running ARC image by digest. The targets are
`proofing` with Node 24.22.3 and Playwright 1.64.1 Chromium, `realtimestack`
with the Linux x64 .NET 10.0.15 AOT runtime and compiler packs, and `codeql`
with the 2.27.5 CLI and precompiled query packs. Build one target with:

```powershell
docker build --target proofing -f arc-runners/image/Dockerfile.profiles -t cormier-runner-candidate:proofing arc-runners/image
```

Use the `shared` target for the general-purpose pool. It combines the
Proof Studio browser tools and RealtimeStack Native AOT packages while
retaining the base ARC entrypoint. The `codeql-cache` target contains only
the CodeQL tool-cache files. Publish that artifact to a private registry and
seed it in jobs that have access to the project's pull credential.

Use the Runner profile benchmark workflow to verify the matching workloads
on `cormier-runners`. Its November 21, 2026 comparison measured 30.49 s to
1.26 s for Node and Chromium preparation and launch, 13.66 s to 8.78 s for
the Native AOT smoke build, and 93.53 s to 56.10 s for CodeQL setup and the
sample scan. The comparison excluded runner image pulls and full application
pipeline time. Publish CodeQL images only to a registry approved for licensed
internal use.

The PGlite profile helper builds migration-only fixtures from a checked-out
repository and compares fresh migration with snapshot loading. It keys the
fixture to the Node version, package lock and migration bytes.

[Matched benchmark run](https://github.com/Cormier-Solutions-LLC/rancher-plugin-suite/actions/runs/44928650674)

Extends the exact Ubuntu 24.04 x64 Actions runner digest currently used by ARC.
The runner entrypoint and Docker-in-Docker wiring stay compatible with ARC 0.14.2.

The image supplies the current CI requirements: Node 26.10.0 with npm 12.1.0,
.NET 8 and 10 SDKs, Temurin JDK 25, Go 1.27.1, Rust 1.98.1 with Clippy and
rustfmt, Erlang/OTP 29.0.6, Elixir 1.20.4, PowerShell 7.6.6, Pester 5.7.1,
PSScriptAnalyzer 1.24.0, native build/AOT dependencies, ShellCheck, Docker CLI,
Buildx and Compose, and Playwright 1.63.0 with Chromium, Firefox and WebKit.
Node 22 and Python 3.11/3.13 are also cached for the other audited Linux jobs.
Those repositories continue using their existing runner selections.

The Maven 3.9.12 and Gradle 9.7.1 wrapper archives are cached with the checksums
declared by the current example projects. Corepack 0.36.0 and pnpm 10.15.0 are
available. Deployment tools include gh 2.101.0 and Helm 3.22.0. kubectl 1.35.7
matches the current cluster; workflows requesting 1.37.1 still use their
existing installer. That existing workflow default needs a separate compatibility
correction before using it against Kubernetes 1.35.

SDKs are installed through the same setup actions as the workflows, using
immutable action commits in `actions.lock.json`. `prepare.py` verifies the
locked archive hashes when reconstructing the build context. Wildcard SDK
patches resolve when building the image; `/opt/ci-tools/manifest.json` records
the resulting SDK/cache entries and installed Ubuntu package versions. Promote
and deploy an image by its content digest, so existing runners never change
silently when a tag or upstream version advances.

```powershell
python arc-runners/image/prepare.py
$RunnerImage = "$env:CI_RUNNER_REPOSITORY`:2026.10.11-1"
docker build --tag $RunnerImage arc-runners/image
docker push $RunnerImage
docker buildx imagetools inspect $RunnerImage
```

The image build needs Linux x64 Docker, Python and `gh` for the initial action
lock only. A populated action lock can be rebuilt without GitHub credentials.
Registry authentication is supplied to Docker outside the build. Credentials,
application source, repository dependencies and job workspaces are not baked
into the image. Application dependency restores and Docker build caches remain
job-specific.

ARC mounts a fresh workspace and starts a fresh runner after each job. Tool
caches live outside that workspace at `/opt/hostedtoolcache`; .NET lives at
`/home/runner/.dotnet`; browser engines live at `/opt/playwright-browsers`.
The matching CI changes verify requested versions before reusing npm,
PowerShell, its modules, or browser system dependencies. Version changes retain
the normal install path.

Before rollout, run the setup contract tests, launch all three browser engines,
publish/run a Native AOT smoke application, and verify a Kubernetes canary
using the existing Docker sidecar and shared workspace. Pre-pull the digest on
all worker nodes. Back up Helm values, then replace only the runner container
image in the values; preserve the original small `init-dind-externals` image.
The 16-runner capacity and one-hour idle policy are separate from the image.

For rollback, restore the previous runner image through Helm. Keep the idle
policy and quota in place. The CI setup changes work with the original image
because they fall back to installing missing tools.
