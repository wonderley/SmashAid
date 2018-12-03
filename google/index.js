// Copyright 2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const {dialogflow, BasicCard} = require('actions-on-google');
const functions = require('firebase-functions');
const {Storage} = require('@google-cloud/storage');

const app = dialogflow({debug: true});

app.intent('CharacterMoveIntent', (conv) => {
  const character = conv.parameters.character;
  const move_type = conv.parameters.move_type;
  const response = `You asked for ${character}'s ${move_type}.`;
  const storage = new Storage();
  const myBucket = storage.bucket('smash-aid-218514.appspot.com');
  const file = myBucket.file(`${character}.json`);
  return file.download().then(function(data) {
    const contents = data[0].toString();
    console.log('download complete!');
    console.log(contents);
    conv.add(response);
    conv.add(new BasicCard({
      title: `Character and move`,
      text: response,
    }));
  })
  .catch(err => {
    conv.add(`Sorry, I didn't understand that.`);
  });

});

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);