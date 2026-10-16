#!/bin/sh
# Run one of the tool scripts in the podman image built from tools/Containerfile,
# with the repo mounted at /work. Arguments go to node, for example:
#   tools/run.sh shoot.mjs --browsers chromium,webkit --only tabs
#   tools/run.sh gif.mjs
set -eu
cd "$(dirname "$0")/.."
IMAGE=simple-material-tools
podman build --quiet --tag "$IMAGE" tools >/dev/null
podman run --rm --init --ipc=host -v "$PWD:/work" "$IMAGE" node "$@"
