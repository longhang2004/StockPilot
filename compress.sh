#!/usr/bin/env bash
# Script wrapper to compress repository
# Usage: ./compress.sh [-o output.zip] [-f zip|tar.gz]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/scripts/compress.py"

if command -v python3 &>/dev/null; then
    exec python3 "$PYTHON_SCRIPT" "$@"
else
    echo "❌ Error: python3 is required to run compress.py"
    exit 1
fi
