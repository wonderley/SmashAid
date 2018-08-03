#!/bin/bash
# Remove first 5 characters and last 12 to get test names
directories=$(find json -name '*.input.json' -depth 1 | cut -c6- | rev | cut -c12- | rev)
for d in $directories; do
  ./testInput.js $d
done
