'use strict';
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

/**
 * This sample demonstrates a simple skill built with the Amazon Alexa Skills Kit.
 * The Intent Schema, Custom Slots, and Sample Utterances for this skill, as well as
 * testing instructions are located at http://amzn.to/1LzFrj6
 *
 * For additional samples, visit the Alexa Skills Kit Getting Started guide at
 * http://amzn.to/1LGWsLG
 */


// --------------- Helpers that build all of the responses -----------------------

String.prototype.replaceAll = function(target, replacement) {
  return this.split(target).join(replacement);
};

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
  return {
    outputSpeech: {
      type: 'PlainText',
      text: output,
    },
    card: {
      type: 'Simple',
      title: `SessionSpeechlet - ${title}`,
      content: `SessionSpeechlet - ${output}`,
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

function buildResponse(sessionAttributes, speechletResponse) {
  return {
    version: '1.0',
    sessionAttributes,
    response: speechletResponse,
  };
}

function readFile(bucketName, filename, onFileContent, onError) {
  console.log(`Reading ${filename} from ${bucketName}`);
  const params = { Bucket: bucketName, Key: filename };
  s3.getObject(params, function (err, data) {
    if (!err) 
      onFileContent(filename, data.Body.toString());
    else
      onError(err);
  });
}


// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
  // If we wanted to initialize the session to have some attributes we could add those here.
  const sessionAttributes = {};
  const cardTitle = 'Welcome';
  const speechOutput = 'Welcome to Smash Aid. ' +
    'Ask about a move for any character.';
  // If the user either does not reply to the welcome message or says something that is not
  // understood, they will be prompted again with this text.
  const repromptText = 'Please ask about a move for any character. For example, say, ' +
    'tell me about Mario\'s up smash.';
  const shouldEndSession = false;

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
  const cardTitle = 'Session Ended';
  const speechOutput = 'Thank you for trying the Alexa Skills Kit sample. Have a nice day!';
  // Setting this to true ends the session and exits the skill.
  const shouldEndSession = true;

  callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

function speechOutputForMoveGroup(character, group, data) {
  debugger;
  let output;
  const movesInGroup = Array.isArray(data) ? data : [data];
  if (movesInGroup.length === 1) {
    output = speechOutputForMoveData(character, group, movesInGroup[0], true);
  }
  else {
    output = `${character}'s ${group} has ${movesInGroup.length} parts.`
    movesInGroup.forEach(moveData => {
      const move = `${group} ${moveData.modifier}`;
      output += ' ' + speechOutputForMoveData(character, move, moveData, false);
    });
  }
  // Put FAF at the end
  let fafStr = '';
  const movesWithFaf = movesInGroup.filter(data => data.faf);
  if (movesWithFaf.length) {
    const faf = movesWithFaf[0].faf;
    fafStr = `${character} can act on frame ${faf}.`;
  }
  return `${output} ${fafStr}`;
}

// Returns [speech output, faf output]
function speechOutputForMoveData(character, move, data, verbose) {
  debugger;
  let activeStr;
  if (data.hitbox_active.includes(',')) {
    const commas = data.hitbox_active.split(',');
    const allButLastItem = commas.splice(0, commas.length - 1).join(',');
    const lastItem = commas[commas.length - 1];
    let activeFramesStr = `frames ${allButLastItem} and ${lastItem}`;
    activeStr = `${move} are active ${activeFramesStr}.`;
  } else {
    let framesStr = 'frame';
    if (data.hitbox_active.includes('-')) {
      framesStr = 'frames';
    }
    let activeFramesStr = `${framesStr} ${data.hitbox_active}`;
    activeStr = `${move} is active ${activeFramesStr}.`;
  }
  activeStr = activeStr.replaceAll('-', ' to ');
  if (verbose) activeStr = `${character}'s ${activeStr}`;
  return activeStr;
}

function getSlot(intent, slotName) {
  try {
  return intent.slots[slotName].resolutions.resolutionsPerAuthority[0].values[0].value.name;
  } catch (e) {
    return undefined;
  }
}

function onCharacterMoveIntent(intent, session, callback) {
  let sessionAttributes = session.attributes || {};
  let cardTitle = 'Error';
  let move = sessionAttributes.move;
  let character = sessionAttributes.character;
  let speechOutput = 'What is the character and move?';
  let repromptText = 'What is the character and move?';
  let shouldEndSession = false;
  try {
    console.log(intent);
    console.log(session);
    console.log(intent.slots.character);
    console.log(intent.slots.move_type);
    cardTitle = intent.name;
    move = getSlot(intent, 'move_type') || move;
    character = getSlot(intent, 'character') || character;
    if (character) {
      sessionAttributes.character = character;
    } 
    if (move) {
      sessionAttributes.move = move;
    }
    if (character && !move) {
      cardTitle = 'Move';
      speechOutput = `What move of ${character} do you want to know about?`;
      repromptText = `I didn't get that. ${speechOutput}`;
      callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
      return;
    }
    if (move && !character) {
      cardTitle = 'Move';
      speechOutput = `Which character's ${move} do you want to know about?`;
      repromptText = `I didn't get that. ${speechOutput}`;
      callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
      return;
    }
    shouldEndSession = false;
    speechOutput = '';
    repromptText = '';
  } catch (e) {
    console.log(e);
    callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
  }
  
  // read from s3
  readFile('aws-lambda-smashproject', `${character.replaceAll(' ', '_')}.json`, (filename, result) => {
    try {
      result = JSON.parse(result);
      speechOutput = speechOutputForMoveGroup(character, move, result.moveset[move]);
      repromptText = '';
      callback(sessionAttributes,
       buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    } catch (e) {
      speechOutput = `I couldn't find the ${move} for ${character}.`;
      callback(sessionAttributes,
       buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    }
  }, (err) => {
    console.log(err);
    repromptText = speechOutput = `I can't find any information about ${character}`;
    callback(sessionAttributes,
     buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
  });
}

// --------------- Events -----------------------

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
  // console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
  //console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

  // Dispatch to your skill's launch.
  getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
  console.log(`intentRequest ${intentRequest}`);
  console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

  const intent = intentRequest.intent;
  const intentName = intentRequest.intent.name;

  // Dispatch to your skill's intent handlers
  if (intentName === 'CharacterMoveIntent') {
    console.log('Going in onCharacterMoveIntent');
    onCharacterMoveIntent(intent, session, callback);
  } else if (intentName === 'AMAZON.HelpIntent') {
    getWelcomeResponse(callback);
  } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
    handleSessionEndRequest(callback);
  } else {
    triggerError(callback);
  }
}

function triggerError(callback) {
  console.log('error');
  let cardTitle = 'Error';
  let move = 'Error';
  let character = 'Error';
  let sessionAttributes = {};
  let speechOutput = 'Error';
  let repromptText = 'There is an error';
  let shouldEndSession = true;
  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
  console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
  // Add cleanup logic here
}


// --------------- Main handler -----------------------

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = (event, context, callback) => {
  try {
    /**
     * Uncomment this if statement and populate with your skill's application ID to
     * prevent someone else from configuring a skill that sends requests to this function.
     */
    /*
    if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]') {
       callback('Invalid Application ID');
    }
    */

    if (event.session.new) {
      onSessionStarted({ requestId: event.request.requestId }, event.session);
    }

    if (event.request.type === 'LaunchRequest') {
      onLaunch(event.request,
        event.session,
        (sessionAttributes, speechletResponse) => {
          callback(null, buildResponse(sessionAttributes, speechletResponse));
        });
    } else if (event.request.type === 'IntentRequest') {
      onIntent(event.request,
        event.session,
        (sessionAttributes, speechletResponse) => {
          callback(null, buildResponse(sessionAttributes, speechletResponse));
        });
    } else if (event.request.type === 'SessionEndedRequest') {
      onSessionEnded(event.request, event.session);
      callback();
    }
  } catch (err) {
    callback(err);
  }
};
