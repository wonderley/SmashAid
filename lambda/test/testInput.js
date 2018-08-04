#!/usr/bin/env node
'use strict';

const fs = require('fs');
const expect = require('chai').expect;
const proxyquire = require('proxyquire').noCallThru();
function S3() {
  return {
    getObject: (params, callback) => {
      debugger;
      let data;
      let err;
      try {
        data = fs.readFileSync(`${__dirname}/../../gen/${params.Key}`);
      } catch (e) {
        err = e;
      }
      callback(err, { Body: data });
    },
  };
}
const index = proxyquire('../index', {
  'aws-sdk': {
    S3,
  },
});

function test(testName) {
  const inputPath = `${__dirname}/json/${testName}.input.json`;
  const outputPath = `${__dirname}/json/${testName}.output.json`;
  const input = JSON.parse(fs.readFileSync(inputPath));
  const output = JSON.parse(fs.readFileSync(outputPath));
  index.handler(input, input.context,
    (_, response) => {
      try {
        expect(response).to.deep.equal(output.body);
      } catch (e) {
        console.error(`${testName} failed`);
        throw e;
      }
    });
}

if (require.main === module) {
  const testName = process.argv[2] || 'open';
  test(testName);
}
