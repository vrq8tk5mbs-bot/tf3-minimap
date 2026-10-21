#!/bin/bash
# Double-click to start the TF3 Minimap companion. Needs Python 3:
# if it is missing, macOS offers to install it (Command Line Tools) - accept and run this again.
cd "$(dirname "$0")" || exit 1
TF3MAP_PAUSE=1 python3 tf3map_server.py "$@"
