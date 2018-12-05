#!/usr/bin/env node
'use strict';

const fs = require('fs');
const expect = require('chai').expect;
const proxyquire = require('proxyquire').noCallThru();
function S3() {
  return {
    getObject: (params) => {
      return {
        promise: () => {
          return new Promise((resolve, reject) => {
            let data;
            let err;
            try {
              data = fs.readFileSync(`${__dirname}/input/${params.Key}`);
            } catch (e) {
              err = e;
            }
            err ? reject(err) : resolve({ Body: data });
          });
        },
      };
    },
  };
}

const BuildSpeechletResponse = proxyquire('../BuildSpeechletResponse', {
  'aws-sdk': {
    S3,
  },
});
const CharacterMoveIntentHandler = proxyquire('../CharacterMoveIntentHandler', {
  'aws-sdk': {
    S3,
  },
  'BuildSpeechletResponse': BuildSpeechletResponse,
});
const index = proxyquire('../index', {
  'AlexaCharacterMoveIntentHandler': proxyquire('../AlexaCharacterMoveIntentHandler', {
    'aws-sdk': {
      S3,
    },
    BuildSpeechletResponse,
    CharacterMoveIntentHandler,
  }),
  BuildSpeechletResponse,
});

function test(testName) {
  const inputPath = `${__dirname}/json/${testName}.input.json`;
  const outputPath = `${__dirname}/json/${testName}.output.json`;
  const input = JSON.parse(fs.readFileSync(inputPath));
  const output = JSON.parse(fs.readFileSync(outputPath));
  // For some reason the callback is called more than once
  let testDone = false;
  index.handler(input, input.context,
    (_, response, third, fourth) => {
      debugger;
      if (testDone) return;
      testDone = true;
      try {
        if (output.body && output.body.userAgent)
          response.userAgent = output.body.userAgent;
        expect(response).to.deep.equal(output.body);
      } catch (e) {
        console.error(`${testName} failed`);
        console.error(e);
        process.exit(1);
      }
    });
}

if (require.main === module) {
  const testName = process.argv[2] || 'open';
  test(testName);
}
