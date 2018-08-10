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
  const cardTitle = 'Smash Aid';
  const speechOutput = 'Welcome to Smash Aid. ' +
    'Ask about a move for any character.';
  // If the user either does not reply to the welcome message or says something that is not
  // understood, they will be prompted again with this text.
  const repromptText = 'Please ask about a move for any character. For example, say, ' +
    'tell me about Mario\'s up smash.';
  const shouldEndSession = false;

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession, speechOutput));
}

function handleSessionEndRequest(callback) {
  const cardTitle = 'Exiting Smash Aid';
  const speechOutput = 'Thanks for using Smash Aid!';
  // Setting this to true ends the session and exits the skill.
  const shouldEndSession = true;

  callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession, speechOutput));
}

function speechOutputForMoveGroup(character, group, data) {
  let movesInGroup = Array.isArray(data) ? data : [data];
  // Get rid of parts of the move group with no value
  // for hitbox_active. For example, Falcon's Falcon
  // Dive (Latch). This presumably only applies to
  // multi-hit moves, but definitely not to dodges.
  if (movesInGroup.length > 1) {
    movesInGroup =
      movesInGroup.filter(
        moveData => !!moveData.hitbox_active);
  }
  if (!movesInGroup.length) {
    throw new Error('No valid moves in the group');
  }
  let output;
  if (movesInGroup.length === 1) {
    const moveData = movesInGroup[0];
    if (moveData.hitbox_active) {
      output = speechOutputForAttackData(character, group, moveData, true);
    } else if (moveData.intangibility) {
      output = speechOutputForDodgeData(character, group, moveData);
    } else if (moveData.weight_dependent) {
      output = speechOutputForThrowData(character, group, moveData);
    } else {
      throw new Error('Unrecognized move data');
    }
  }
  else {
    output = `${character}'s ${group} has ${movesInGroup.length} parts.`
    movesInGroup.forEach((moveData, idx) => {
      const move = 
        moveData.modifier ? moveData.modifier
                          : (idx === 0 ? 'the first one'
                                       : 'the next one');
      output += ' ' + speechOutputForAttackData(character, move, moveData, false);
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

function speechOutputForAttackData(character, move, data, verbose) {
  let activeStr;
  const firstWordInHitboxActive = data.hitbox_active.split(' ')[0];
  if (!parseInt(firstWordInHitboxActive)) {
    // Handle Mario FLUDD: "Max Charge: Frame 98"
    // Don't want to say "is active frame max charge..."
    // Settle for "is active max charge..."
    return `${move} is active ${data.hitbox_active}.`;
  }
  if (data.hitbox_active.split(' ')[0])
  if (data.hitbox_active.includes(',')) {
    const commas = data.hitbox_active.split(',');
    const allButLastItem = commas.splice(0, commas.length - 1).join(',');
    const lastItem = commas[commas.length - 1];
    let activeFramesStr = `frames ${allButLastItem} and ${lastItem}`;
    activeStr = `${move} is active ${activeFramesStr}.`;
  } else {
    let framesStr = 'frame';
    if (data.hitbox_active.includes('-')) {
      framesStr = 'frames';
      data.hitbox_active = data.hitbox_active.replaceAll('-', ' to ');
    }
    let activeFramesStr = `${framesStr} ${data.hitbox_active}`;
    activeStr = `${move} is active ${activeFramesStr}.`;
  }
  activeStr = activeStr.replaceAll('-', ' to ');
  if (move.includes('hit') && move.includes('-')) {
    // Handle plural move modifier, e.g. hits 1-3 are...
    activeStr = activeStr.replaceAll(' is ', ' are ')
                         .replaceAll(' hit ', ' hits ');
  }
  if (verbose) activeStr = `${character}'s ${activeStr}`;
  return activeStr;
}

function speechOutputForDodgeData(character, move, data) {
  return `${character}'s ${move} is intangible frames ${data.intangibility}.`;
}

function speechOutputForThrowData(character, move, data) {
  const not = data.weight_dependent ? '' : ' not ';
  return `${character}'s ${move} is ${not} weight dependent.`;
}

function getSlot(intent, slotName) {
  try {
  return intent.slots[slotName].resolutions.resolutionsPerAuthority[0].values[0].value.name;
  } catch (e) {
    return undefined;
  }
}

function capitalize(input) {
  return input.split(' ').map(word => {
    if (!word) return word;
    if (word.length === 1) return word.toUpperCase();
    else return word[0].toUpperCase() + word.substring(1);
  }).join(' ');
}

function onCharacterMoveIntent(intent, session, callback) {
  let sessionAttributes = session.attributes || {};
  let cardTitle = 'Failed to find move';
  let move = sessionAttributes.move;
  let character = sessionAttributes.character;
  let speechOutput = 'What character and move are you interested in?';
  let repromptText = 'Please name a character and move. For example, say, tell me about Mario\'s up smash.';
  let shouldEndSession = false;
  try {
    console.log(JSON.stringify(intent));
    console.log(session);
    console.log(intent.slots.character);
    console.log(intent.slots.move_type);
    move = getSlot(intent, 'move_type') || move;
    character = getSlot(intent, 'character') || character;
    if (character) {
      sessionAttributes.character = character;
    } 
    if (move) {
      sessionAttributes.move = move;
    }
    if (!character && !move) {
      cardTitle = 'Choose a character and move';
      callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
      return;
    } else if (character && !move) {
      cardTitle = `${capitalize(character)}`;
      speechOutput = `Which of ${capitalize(character)}'s moves?`;
      repromptText = `I didn't get that. ${speechOutput}`;
      callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
      return;
    } else if (move && !character) {
      cardTitle = `${capitalize(move)}`;
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
  const characterFileName = character
    .replaceAll(' ', '_').replaceAll('junior', 'jr')
    .replaceAll('doctor', 'dr');
  readFile('aws-lambda-smashproject', `${characterFileName}.json`, (_, result) => {
    const Character = capitalize(character);
    try {
      result = JSON.parse(result);
      let moveObj;
      if (move.includes('special')) {
        const specialMoveObj = 
          result.moveset.specials.filter(
            special => special.name === move
          )[0];
        move = `${move}, ${capitalize(specialMoveObj.otherName)}`;
        move += ',';
        moveObj = specialMoveObj.value;
      } else {
        moveObj = result.moveset[move];
      }
      cardTitle = capitalize(`${character}'s ${move}`);
      speechOutput = speechOutputForMoveGroup(
        Character, move, moveObj);
      speechOutput += ` You can ask about another one of ${Character}'s moves, or name another character and move.`;
      repromptText = `Ask about another one of ${Character}'s moves, or name another character and move.`;
      callback(sessionAttributes,
       buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    } catch (e) {
      speechOutput = `Sorry, I don't have any information about the ${move} for ${Character}. Please name another character and move.`;
      cardTitle = 'Please try again';
      callback(sessionAttributes,
       buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession, speechOutput));
    }
  }, (err) => {
    console.log(err);
    repromptText = speechOutput = `My B. I can't find any information about ${character}.`;
    cardTitle = 'Please try again';
    callback(sessionAttributes,
     buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession, speechOutput));
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
    let speechOutput = 'My B. I didn\'t understand what you said. Please name a character and move.';
    let repromptText = 'Please name a character and move. For example, say, tell me about Mario\'s up smash.';
    let shouldEndSession = false;
    callback(session.attributes || {},
      buildSpeechletResponse('Please try again', speechOutput, repromptText, shouldEndSession, speechOutput));
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
