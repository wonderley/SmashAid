#!/bin/bash
directories=$(find . -type d -depth 1)
for d in $directories; do
  ./testInput.sh $d
done
