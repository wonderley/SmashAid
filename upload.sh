#!/bin/bash
jsonFiles=$(find gen -name '*.json')
for f in $jsonFiles; do
  # aws s3 cp "$f" s3://aws-lambda-smashproject
  # Upload to Google
  gsutil cp "$f" gs://smash-aid-218514.appspot.com/
done
