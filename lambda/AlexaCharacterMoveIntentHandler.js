'use strict';
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const CharacterMoveIntentHandler = require('CharacterMoveIntentHandler');

class AlexaCharacterMoveIntentHandler extends CharacterMoveIntentHandler {
  // Returns a Promise that resolves to
  // a Buffer with the resulting file data
  readFile(filename) {
    // Read from S3
    const bucketName = 'aws-lambda-smashproject';
    console.log(`Reading ${filename} from ${bucketName}`);
    const params = { Bucket: bucketName, Key: filename };
    return s3.getObject(params).promise()
            .then(data => data.Body);
  }
}

module.exports = AlexaCharacterMoveIntentHandler;