#!/usr/bin/env node
'use strict';

const AbstractToJson = require('pagetojson').AbstractToJson;
const cheerio = require('cheerio');
const fs = require('fs');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const characters =
  ['Mario', 'Luigi', 'Peach', 'Bowser', 'Yoshi',
 'Rosalina And Luma', 'Donkey Kong', 'Diddy Kong',
 'Link', 'Zelda', 'Sheik', 'Toon Link', 'Samus',
 'Zero Suit Samus', 'Pit', 'Palutena', 'Marth', 'Ike',
 'Robin', 'Kirby', 'King Dedede', 'Meta Knight', 'Little Mac',
 'Fox', 'Pikachu', 'Charizard', 'Lucario', 'Greninja',
 'Captain Falcon', 'Villager', 'Olimar', 'Wii Fit Trainer',
 'Shulk', 'Pac-Man', 'Mega Man', 'Sonic', 'Ness', 'Falco',
 'Wario', 'Lucina', 'Dark Pit', 'Dr. Mario', 'R.O.B', 'Ganondorf',
 'Game And Watch', 'Bowser Jr', 'Duck Hunt', 'Jigglypuff',
 'Mewtwo', 'Lucas', 'Roy', 'Ryu', 'Cloud', 'Corrin', 'Bayonetta'];

let $;
const standardMoveTypeMap = {
  utilt: 'up tilt',
  dtilt: 'down tilt',
  ftilt: 'forward tilt',
  fsmash: 'forward smash',
  dsmash: 'down smash',
  usmash: 'up smash',
  airdodge: 'air dodge',
  spotdodge: 'spot dodge',
  dthrow: 'down throw',
  uthrow: 'up throw',
  bthrow: 'back throw',
  fthrow: 'forward throw',
  nair: 'neutral air',
  fair: 'forward air',
  dair: 'down air',
  uair: 'up air',
  bair: 'back air',
};

async function collect(character) {
  let tables;
  try {
    tables = await fetchTables(character);
  } catch (e) {
    console.error(`Failed to fetch ${character}`);
    return;
  }
  try {
    const characterObj = characterObjectFromTables(tables, character);
    const characterObjStr = JSON.stringify(characterObj, null, 2);
    if (!fs.existsSync('./gen')) {
      fs.mkdirSync('./gen');
    }
    const fileName = character.toLowerCase().replaceAll('.', '').replaceAll(' ', '_').replaceAll('-', '_');
    fs.writeFileSync(`./gen/${fileName}.json`, characterObjStr);
  } catch (e) {
    console.error(`Failed to parse ${character}`);
  }
}

String.prototype.replaceAll = function(target, replacement) {
  return this.split(target).join(replacement);
};

async function fetchTables(character) {
  const url = `http://kuroganehammer.com/Smash4/${character}`;
  const html = await AbstractToJson.fetchUrl(url);
  $ = cheerio.load(html);
  const tables = $('table');
  return tables;
}

function toMoveNameObject(moveType) {
  function standardize(moveType) {
    const moveTypeLower = moveType.toLowerCase()
      .replaceAll('.', '');
    return (standardMoveTypeMap[moveTypeLower] || moveTypeLower);
  }
  // ex. ftilt (up angled)
  const hasParenModifier = moveType.includes('(');
  // ex. jab 1
  const hasNumberModifier = !!parseInt(moveType[moveType.length - 1]);
  if (hasParenModifier) {
    const indexOfModifier = moveType.indexOf(' (');
    const basicMoveType = moveType.substring(0, indexOfModifier);
    const modifier = moveType.substring(indexOfModifier)
      .toLowerCase().replace('(', '')
      .replace(')', '').replace(',', '');
    return {
      group: `${standardize(basicMoveType)}`,
      modifier,
    };
  } else if (hasNumberModifier) {
    const words = moveType.split(' ');
    return {
      group: standardize(
              words.slice(0, words.length - 1)
                   .join(' ')
             ),
      modifier: words[words.length - 1],
    };
  } else {
    return {
      group: standardize(moveType),
      modifier: ''
    };
  }
}

function characterObjectFromTables(tables, character) {
  // If table length is more than 4, assume that
  // one of those is after the attributes table.
  let extra = tables.length > 4 ? 1 : 0;
  if (character === 'Shulk' || character === 'Bayonetta')
    extra = 0; // exceptions
  const attributesTable = tables[0],
        groundTable = tables[1 + extra],
        aerialsTable = tables[2 + extra],
        specialsTable = tables[3 + extra];
  const moveset = {};
  addAttributes(moveset, attributesTable);
  addGroundMoves(moveset, groundTable);
  addAerials(moveset, aerialsTable);
  addSpecials(moveset, specialsTable);
  return {
    moveset,
  };
}

function addAttributes(moveset, table) {
}

function addGroundMoves(moveset, table) {
  const groundRows = $(table).find('tr');
  groundRows.each(function(i, tr) {
    const rowHeaders = $(tr).find('th');
    // Ignore rows with multiple headers.
    // They don't have data.
    if (rowHeaders.length > 1) return;
    // Move objects have a group and modifier
    const moveNameObject = 
      toMoveNameObject($(rowHeaders[0]).text());
    const group = moveNameObject.group;
    const rowData = extractRowData(tr);
    if (group.includes('throw')) {
      moveset[group] = createThrow(rowData);
    } else if (group.includes('grab')) {
      moveset[group] = createGrab(rowData);
    } else if (group.includes('dodge')
            || group.includes('roll')) {
      moveset[group] = createMisc(rowData);
    } else {
      const attack = createAttack(rowData);
      addMoveToMoveset(attack, moveNameObject, moveset);
    }
  });
}

function addAerials(moveset, table) {
  const aerialRows = $(table).find('tr');
  aerialRows.each(function(i, tr) {
    const rowHeaders = $(tr).find('th');
    // Ignore rows with multiple headers. They don't have data.
    if (rowHeaders.length > 1) return;
    const moveNameObject =
      toMoveNameObject($(rowHeaders[0]).text());
    const rowData = extractRowData(tr);
    const aerial = createAerial(rowData);
    addMoveToMoveset(aerial, moveNameObject, moveset);
  });
}

function addSpecials(moveset, table) {
  const specialRows = $(table).find('tr');
  // Keep track of specials to convert to standard names
  const knownSpecials = [];
  specialRows.each(function(i, tr) {
    const rowHeaders = $(tr).find('th');
    // Ignore rows with multiple headers.
    // They don't have data.
    if (rowHeaders.length > 1) return;
    const moveNameObject = 
      toMoveNameObject($(rowHeaders[0]).text());
    // Ignore trolling on Zelda page
    if (moveNameObject.group
        === 'shovel knight deconfirmed') return;
    const rowData = extractRowData(tr);
    const special = createSpecial(rowData);
    addMoveToMoveset(special, moveNameObject, moveset);
  });
}

function addMoveToMoveset(move, moveNameObject, moveset) {
  move.modifier = moveNameObject.modifier;
  const group = moveNameObject.group;
  if (!moveset[group]) moveset[group] = [];
  moveset[group].push(move);
}

function createThrow(rowData) {
  expect(rowData.length === 6, `Expected rowData length of 5 but found ${rowData.length}`);
  expect(rowData[0] === 'Yes'
     || rowData[0].includes('No'),
     'Unexpected value for "Weight Dependent"');
  return {
    weight_dependent: rowData[0] === 'Yes',
    base_dmg: rowData[1],
    angle: rowData[2],
    bkb_wbkb: rowData[3],
    kbg: rowData[4],
  };
}

function createMisc(rowData) {
  expect(rowData.length === 6, `Expected rowData length of 2 but found ${rowData.length}`);
  return {
    intangibility: rowData[0],
    faf: rowData[1],
  };
}

function createGrab(rowData) {
  expect(rowData.length === 6, `Expected rowData length of 2 but found ${rowData.length}`);
  return {
    hitbox_active: rowData[0],
    faf: rowData[1],
  };
}

function createAttack(rowData) {
  expect(rowData.length === 6, `Expected rowData length of 6 but found ${rowData.length}`);
  return {
    hitbox_active: rowData[0],
    faf: rowData[1],
    base_dmg: rowData[2],
    angle: rowData[3],
    bkb_wbkb: rowData[4],
    kbg: rowData[5],
  };
}

function createAerial(rowData) {
  expect(rowData.length === 8, `Expected rowData length of 8 but found ${rowData.length}`);
  return {
    hitbox_active: rowData[0],
    faf: rowData[1],
    base_dmg: rowData[2],
    angle: rowData[3],
    bkb_wbkb: rowData[4],
    kbg: rowData[5],
    landing_lag: rowData[6],
    autocancel: rowData[7],
  };
}

function createSpecial(rowData) {
  return createAttack(rowData);
}

function extractRowData(tr) {
  let rowData = [];
  $(tr).find('td').each(function(_, td) {
    let text = $(td).text();
    if (!text || text === '-') text = '';
    rowData.push(text);
  });
  return rowData;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length) {
    const character = args.join(' ');
    collect(character);
  } else {
    collectAll();
  }
}

async function collectAll() {
  for (let character of characters) {
    await collect(character);
  }
}
