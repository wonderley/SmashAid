'use strict';
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

function buildSpeechletResponse(title, output, repromptText, shouldEndSession, cardContent) {
  return {
    outputSpeech: {
      type: 'PlainText',
      text: output,
    },
    card: {
      type: 'Simple',
      title: `${title}`,
      content: '',
    },
    reprompt: {
      outputSpeech: {
        type: 'PlainText',
        text: repromptText,
      },
    },
    shouldEndSession,
  };
}

module.exports = buildSpeechletResponse;