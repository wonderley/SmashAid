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

function speechOutputForMoveData(character, move, data) {
  let activeFramesStr;
  if (data.hitbox_active.includes(',')) {
    throw new Error('Cannot determine active frames due to comma.')
  } else if (data.hitbox_active.includes('-')) {
    const activeFrames = data.hitbox_active.split('-');
    activeFramesStr = `frames ${activeFrames[0]} through ${activeFrames[1]}`;
  } else {
    activeFramesStr = `frame ${data.hitbox_active}`;
  }
  let fafStr = '';
  if (data.faf !== '-') {
    fafStr = `${character} can act on frame ${data.faf}`;
  }
  return `${character}'s ${move} is active ${activeFramesStr}. ${fafStr}`;
}

function onCharacterMoveIntent(intent, session, callback) {
  console.log(this);
  console.log(intent);
  console.log(session);
  console.log(callback);
  console.log(intent.slots.move_type);
  const cardTitle = intent.name;
  const move = intent.slots.move_type.resolutions.resolutionsPerAuthority[0].values[0].value.name;
  const character = intent.slots.character.value.toLowerCase();
  let sessionAttributes = {};
  const shouldEndSession = false;
  let speechOutput = '';
  let repromptText = 'What is the character and move?';

  speechOutput = `Character is ${character} and move is ${move}`;
  sessionAttributes.character = character;
  
  // read from s3
  readFile('aws-lambda-smashproject', `${character}.json`, (filename, result) => {
    try {
      console.log(`move ${move}`);
      result = JSON.parse(result);
      speechOutput = speechOutputForMoveData(character, move, result.moveset[move]);
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
    throw new Error('Invalid intent');
  }
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
