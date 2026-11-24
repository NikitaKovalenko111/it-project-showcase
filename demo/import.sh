#!/usr/bin/env bash
set -euo pipefail
# The shared importer targets the isolated Docker demo.
dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
exec node "$dir/import.mjs" "$@"
