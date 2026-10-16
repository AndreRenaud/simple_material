#!/bin/sh
# Render showcase.html in headless Chromium, Firefox and WebKit inside a podman
# container. Output goes to screenshots/. Options are passed to shoot.mjs:
#   tools/shoot.sh --browsers chromium,webkit --schemes dark --only tabs --video
set -eu
cd "$(dirname "$0")/.."
IMAGE=simple-material-shoot
podman build --quiet --tag "$IMAGE" tools >/dev/null
podman run --rm --init --ipc=host -v "$PWD:/work" "$IMAGE" node shoot.mjs "$@"
