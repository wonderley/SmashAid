/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const AlexaCharacterMoveIntentHandler = require('AlexaCharacterMoveIntentHandler');

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const sessionAttributes = {};
    const cardTitle = 'Smash Aid';
    const speechOutput = 'Welcome to Smash Aid. ' +
      'Ask about a move for any character.';
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    const repromptText = 'Please ask about a move for any character. For example, say, ' +
      'tell me about Mario\'s up smash.';
    const shouldEndSession = false;
    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(repromptText)
      .withSimpleCard(cardTitle, '')
      .getResponse();
  },
};

const CharacterMoveIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'CharacterMoveIntent';
  },
  handle(handlerInput) {
    const intent = handlerInput.requestEnvelope.request.intent;
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    return this.handler.onIntent(intent, sessionAttributes)
    .then(responseObj => {
      return handlerInput.responseBuilder
        .speak(responseObj.speechOutput)
        .reprompt(responseObj.repromptText)
        .withSimpleCard(responseObj.cardTitle, '')
        .getResponse();
    });
  },
  handler: new AlexaCharacterMoveIntentHandler(),
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'You can say hello to me!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Hello World', speechText)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const cardTitle = 'Exiting Smash Aid';
    const speechOutput = 'Thanks for using Smash Aid!';
    // Setting this to true ends the session and exits the skill.
    const shouldEndSession = true;
    return handlerInput.responseBuilder
      .speak(speechOutput)
      .withSimpleCard(cardTitle, speechOutput)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    const cardTitle = 'Exiting Smash Aid';
    const speechOutput = 'Thanks for using Smash Aid!';
    // Setting this to true ends the session and exits the skill.
    const shouldEndSession = true;
    return handlerInput.responseBuilder
      .speak(speechOutput)
      .withSimpleCard(cardTitle, speechOutput)
      .getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Sorry, I can\'t understand the command. Please say again.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
      .getResponse();
  },
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    CharacterMoveIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();