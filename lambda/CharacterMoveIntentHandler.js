'use strict';
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const buildSpeechletResponse = require('BuildSpeechletResponse');

class CharacterMoveIntentHandler {
  // No return value.
  // Postcondition: this._responseObj is set
  onIntent(intent, session) {
    debugger;
    let sessionAttributes = session.attributes || {};
    let cardTitle = 'Failed to find move';
    let move = sessionAttributes.move;
    let character = sessionAttributes.character;
    let speechOutput = 'What character and move are you interested in?';
    let repromptText = 'Please name a character and move. For example, say, tell me about Mario\'s up smash.';
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
        this.storeResponseObj(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, repromptText, false /*shouldEndSession*/));
        return;
      } else if (character && !move) {
        cardTitle = `${capitalize(character)}`;
        speechOutput = `Which of ${capitalize(character)}'s moves?`;
        repromptText = `I didn't get that. ${speechOutput}`;
        this.storeResponseObj(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, repromptText, false /*shouldEndSession*/));
        return;
      } else if (move && !character) {
        cardTitle = `${capitalize(move)}`;
        speechOutput = `Which character's ${move} do you want to know about?`;
        repromptText = `I didn't get that. ${speechOutput}`;
        this.storeResponseObj(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, repromptText, false /*shouldEndSession*/));
        return;
      }
      speechOutput = '';
      repromptText = '';
    } catch (e) {
      console.log(e);
      this.storeResponseObj(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, repromptText, false /*shouldEndSession*/));
    }

    // read from file
    const characterFileName = character
      .replaceAll(' ', '_').replaceAll('junior', 'jr')
      .replaceAll('doctor', 'dr');
    return this.readFile(`${characterFileName}.json`)
    .then(jsonResult => {
      onFileContent(jsonResult, character, move, speechOutput, cardTitle, sessionAttributes, repromptText);
    })
    .catch(onFileError, character);
  }
  // Returns a Promise that resolves to
  // a Buffer with the resulting file data
  readFile(filename) {
    throw new Error('readFile not implemented');
  }
}

function onFileContent(jsonResult, character, move, speechOutput, cardTitle, sessionAttributes, repromptText) {
  const Character = capitalize(character);
  try {
    const result = JSON.parse(jsonResult.toString());
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
    this.storeResponseObj(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, false /*shouldEndSession*/));
  } catch (e) {
    speechOutput = `Sorry, I don't have any information about the ${move} for ${Character}. Please name another character and move.`;
    cardTitle = 'Please try again';
    this.storeResponseObj(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, false /*shouldEndSession*/, speechOutput));
  }
}

function onFileError(err, character) {
  console.error(err);
  const speechOutput = `My B. I can't find any information about ${character}.`;
  const cardTitle = 'Please try again';
  this.storeResponseObj(sessionAttributes,
  buildSpeechletResponse(cardTitle, speechOutput, speechOutput /*repromptText*/, false /*shouldEndSession*/, speechOutput));
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

module.exports = CharacterMoveIntentHandler;