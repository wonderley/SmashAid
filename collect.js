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
  let group = moveType;
  let modifier = '';
  // e.g. ftilt (up angled)
  const hasParenModifier = group.includes('(');
  if (hasParenModifier) {
    const indexOfModifier = group.indexOf(' (');
    const basicMoveType = group.substring(0, indexOfModifier);
    modifier = moveType.substring(indexOfModifier)
      .toLowerCase().replace('(', '')
      .replace(')', '').replace(',', '');
    group = basicMoveType;
  }
  // e.g. jab 1
  const hasNumberModifier = !!parseInt(group[group.length - 1]);
  if (hasNumberModifier) {
    const words = group.split(' ');
    group = words.slice(0, words.length - 1).join(' ');
    modifier = `${words[words.length - 1]} ${modifier}`;
  }
  return {
    group: standardize(group),
    modifier,
  };
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
  addSpecials(moveset, character, specialsTable);
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

function addSpecials(moveset, character, table) {
  moveset.specials = [
    {
      name: 'neutral special',
      otherName: '',
      value: []
    },
    {
      name: 'side special',
      otherName: '',
      value: [],
    },
    {
      name: 'up special',
      otherName: '',
      value: [],
    },
    {
      name: 'down special',
      otherName: '',
      value: [],
    },
  ];
  const specialRows = $(table).find('tr');
  let currentSpecialIdx = -1;
  specialRows.each(function(i, tr) {
    const rowHeaders = $(tr).find('th');
    // Ignore rows with multiple headers.
    // They don't have data.
    if (rowHeaders.length > 1) return;
    const moveNameObject = 
      toMoveNameObject($(rowHeaders[0]).text());
    if ([
        // Ignore trolling on Zelda page
        'shovel knight deconfirmed',
        // Ignore Robin's book and Levin Sword
        'book',
        'levin sword',
        // Ignore limit break charge
        'limit break',
        ].includes(moveNameObject.group)) return;
    if (character === 'Ryu') fixRyuMoves(moveNameObject);
    if (character === 'Cloud') fixCloudMoves(moveNameObject);
    const rowData = extractRowData(tr);
    const group = groupNameForSpecial(moveNameObject, character);
    if (currentSpecialIdx === -1
    ||  group !== moveset.specials[currentSpecialIdx]
                                  .otherName) {
      debugger;
      currentSpecialIdx++;
      if (currentSpecialIdx > 3)
        throw new Error
          ('Creating too many special groups');
      moveset.specials[currentSpecialIdx]
                      .otherName = group;
    }
    const special = createSpecial(rowData);
    // For known special groups (see below),
    // use the group plus modifier as the modifier
    special.modifier = group ? moveNameObject.modifier
    : `${moveNameObject.group} ${moveNameObject.modifier}`;
    moveset.specials[currentSpecialIdx].value.push(special);
  });
}

function groupNameForSpecial(moveNameObject, character) {
  const group = moveNameObject.group;
  if (knownSpecialGroups[character]
   && knownSpecialGroups[character].includes(group)) {
    // Edge cases like this will have no group name.
    return '';
  }
  return moveNameObject.group;
}

function fixRyuMoves(moveNameObject) {
  // Light/Medium/Heavy should be considered modifiers
  // Same for Shakunetsu
  ['light ', 'medium ', 'heavy ', 'light shakunetsu ',
  'medium shakunetsu ', 'heavy shakunetsu ', 'shakunetsu '].forEach(extraModifier => {
    if (moveNameObject.group.includes(extraModifier)) {
      moveNameObject.group = 
        moveNameObject.group.substring(extraModifier.length);
      moveNameObject.modifier =
        `${extraModifier}${moveNameObject.modifier}`;
    }
  });
}

function fixCloudMoves(moveNameObject) {
  if (moveNameObject.group.includes('limit')) {
      moveNameObject.group = 
        moveNameObject.group.substring('limit '.length);
      moveNameObject.modifier =
        `limit ${moveNameObject.modifier}`;
   }
}

// Names of specials that should be considered the
// same group, even though their names don't fit
// the usual pattern
const knownSpecialGroups = {
  'Samus': ['homing missile', 'super missile'],
  'Robin': ['thunder', 'elthunder', 'arcthunder',
            'thoron', 'super thoron'],
  'Little Mac': ['ko punch', 'straight lunge'],
  'Shulk': ['monado arts activation',
            'monado arts duration',
            'monado arts cooldown',
           ],
  'Bayonetta': ['no kick heel slide',
                'heel slide',
                'after burner kick'],
};

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
    if (text && text[text.length - 1] === '-')
      text = text.substring(0, text.length - 1);
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
