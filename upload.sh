#!/bin/bash
jsonFiles=$(find gen -name '*.json')
for f in $jsonFiles; do
  aws s3 cp "$f" s3://aws-lambda-smashproject
done
