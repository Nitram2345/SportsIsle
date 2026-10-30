// All gameplay values. Logic never hardcodes these.
// Start values from the design spec; tune by playing.

const t = (name, char, move, def, passable, buildable, flags = []) => ({ name, char, move, def, passable, buildable, flags });

export const TERRAIN = {
  grass:      t('Grasland', 'G', 1, 0, true, true),
  steppe:     t('Steppe', 'T', 1, 0, true, true),
  beach:      t('Strand', 'S', 1, 0, true, true),
  dunes:      t('Dünen', 'D', 2, 0, true, true, ['ground']),
  hillgrass:  t('hügeliges Grasland', 'g', 2, 1, true, true, ['hill']),
  hill:       t('Hügel', 'H', 2, 1, true, true, ['hill']),
  forest:     t('Wald', 'F', 2, 1, true, true, ['forest']),
  hillforest: t('hügeliger Wald', 'h', 3, 2, true, true, ['hill', 'forest']),
  moor:       t('Moor', 'B', 3, 0, true, false),
  mountain:   t('Berg', 'M', 3, 2, true, false, ['mountain']),
  river:      t('Fluss', 'R', 3, 0, true, false, ['water']),
  lake:       t('See', 'L', Infinity, 0, false, false, ['water']),
  sea:        t('Meer', 'W', Infinity, 0, false, false, ['water']),
};

export const TERRAIN_BY_CHAR = Object.fromEntries(Object.entries(TERRAIN).map(([id, v]) => [v.char, id]));

// Height levels for downhill bonuses: mountain 2, hills/hilly forest/dunes 1, rest 0.
for (const v of Object.values(TERRAIN)) v.height = v.flags.includes('mountain') ? 2 : (v.flags.includes('hill') || v.flags.includes('ground')) ? 1 : 0;

export const ROAD_MOVE = 1;

const b = (name, blocks, capturable, produces, sight) => ({ name, blocks, capturable, produces, sight });

export const BUILDINGS = {
  house:       b('Gebäude', true, false, [], 0),
  park:        b('Park', false, true, ['jogger'], 1),
  golf:        b('Golfplatz', true, true, ['golfer'], 2),
  tennis:      b('Tennisanlage', true, true, ['tennis'], 1),
  hockey:      b('Hockeyplatz', true, true, ['hockey'], 1),
  tabletennis: b('Tischtennishalle', true, true, [], 1),
  soccer:      b('Fußballplatz', true, true, ['soccer'], 1),
  dojo:        b('Dojo', true, true, ['karate'], 1),
  rugby:       b('Rugbyplatz', true, true, ['rugby'], 1),
  outdoor:     b('Outdoor-Geschäft', true, true, ['climber'], 1),
};
for (const [id, v] of Object.entries(BUILDINGS)) v.svg = `facilities/${id}.svg`;

const u = (name, hp, atk, def, move, sight, build, range, blockedBy, rangeOnFlag, roadBonus) =>
  ({ name, hp, atk, def, move, sight, build, range, blockedBy, rangeOnFlag, roadBonus });

export const UNITS = {
  golfer: u('Golfer', 8, 4, 1, 3, 3, 3, 3, ['mountain'], null, 1),
  tennis: u('Tennisspieler', 10, 5, 2, 3, 2, 2, 2, ['mountain', 'hill', 'building'], null, 1),
  hockey: u('Hockeyspieler', 10, 7, 2, 3, 2, 3, 2, ['forest', 'hill', 'ground', 'mountain', 'building'], { flag: 'forest', range: 1 }, 1),
  jogger: u('Jogger', 6, 0, 1, 6, 4, 1, 0, [], null, 0),
  soccer: u('Fußballer', 10, 5, 2, 4, 2, 2, 2, ['mountain', 'hill', 'building'], null, 1),
  karate: u('Karateka', 12, 5, 4, 2, 2, 3, 1, [], null, 0),
  rugby:  u('Rugbyspieler', 12, 4, 4, 3, 2, 3, 0, [], null, 0),
  climber: u('Bergsteiger', 8, 4, 2, 4, 3, 2, 2, ['mountain'], null, 0),
};
for (const [id, v] of Object.entries(UNITS)) v.svg = `units/${id}.svg`;
// Special abilities:
// multiMove  – leftover move points can be used for further moves in the same turn.
// zoc        – enemies entering a neighbouring tile must stop there (zone of control).
// ignoresZoc – walks through zones of control.
// dazeOnHit  – after taking damage: next own turn half movement and no attack.
// counter    – strikes back once when attacked from an adjacent tile and survives.
// ram        – attacks by charging (>= 2 tiles run-up): pushes the target one tile on
//              and takes its place; if it cannot give way, stops in front of it.
// climb      – hills, hilly forest and mountains cost 1 move; on a mountain: sight +2 and
//              nothing blocks its throws; attacking downhill: attack +1, range +1.
UNITS.jogger.multiMove = true;
UNITS.hockey.zoc = true;
UNITS.soccer.zoc = true;
UNITS.soccer.dazeOnHit = true;
UNITS.karate.counter = true;
UNITS.rugby.ram = true;
UNITS.rugby.ignoresZoc = true;
UNITS.climber.climb = true;

export const SPECIALS = {
  sprint: { name: 'Sprint', stat: 'move', amount: 2, turns: 3, icon: '⚡' },
  power:  { name: 'Kraftraum', stat: 'atk', amount: 2, turns: 3, icon: '💪' },
  shield: { name: 'Schutzschild', stat: 'def', amount: 1, turns: 3, icon: '🛡️' },
};

export const SKINS = {
  variants: ['m', 'f', 'd'],
  tones: ['#f1c27d', '#d9a066', '#a86b3c', '#6b4226'],
  hairPerVariant: 3,
};

// Colors in the SVG files that get replaced at load time.
export const PLACEHOLDER = { team: '#FF00FF', skin: '#00FFFF' };

export const PLAYER_COLORS = [
  '#e63946', '#2f6fd6', '#f4c20d', '#2a9d4b', '#8e44ad', '#f28c28', '#16b5c4', '#ececec',
  '#ff6fb5', '#7a4a22', '#1f2a44', '#a4d93c', '#b0b7c3', '#7b1e3a', '#ffd9a0', '#00897b',
];

export const RULES = { unitCap: 50, slowdownFrom: 30, slowdownStep: 5, maxPlayers: 16 };
