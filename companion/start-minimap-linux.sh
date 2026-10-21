#!/bin/sh
# Start the TF3 Minimap companion (Linux / Steam Deck desktop mode). Needs Python 3.
cd "$(dirname "$0")" || exit 1
exec python3 tf3map_server.py "$@"
