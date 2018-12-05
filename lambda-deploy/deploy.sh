#!/bin/bash
rm -f deploy.zip
cp -r ../lambda .
rm -r lambda/test
cd lambda
zip -r deploy.zip .
mv deploy.zip ..
cd ..
rm -r lambda
