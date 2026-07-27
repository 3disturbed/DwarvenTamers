import { access } from 'node:fs/promises';
import { ITEM_DB } from '../shared/ItemTypes.js';
import { SKILL_DB } from '../shared/SkillTypes.js';
import { STATION_DB } from '../shared/StationTypes.js';
import { ENEMY_IDS } from '../client/entities/EnemySprites.js';
import resourceSprites, { RESOURCE_IDS } from '../client/entities/ResourceSprites.js';
import { NPC_TYPES } from '../client/entities/NPCSprites.js';
import { TILE_SPRITE_NAMES } from '../client/world/TileSprites.js';
import { UI_ICON_IDS } from '../client/ui/UISprites.js';

const groups = [
  ['items', Object.keys(ITEM_DB)],
  ['skills', Object.keys(SKILL_DB)],
  ['stations', Object.values(STATION_DB).map(def => def.sprite).filter(Boolean)],
  ['enemies', ENEMY_IDS],
  ['resources', RESOURCE_IDS],
  ['npcs', NPC_TYPES],
  ['ui', UI_ICON_IDS],
  ['', [...new Set(Object.values(TILE_SPRITE_NAMES))]],
];

console.log('\nSoloHiem Asset Integrity Tests');
let checked = 0;

for (const [directory, ids] of groups) {
  const missing = [];
  for (const id of ids) {
    const relative = directory
      ? `../tileArt/${directory}/${id}.png`
      : `../tileArt/${id}.png`;
    try {
      await access(new URL(relative, import.meta.url));
      checked++;
    } catch {
      missing.push(relative);
    }
  }
  if (missing.length) {
    throw new Error(`Missing referenced assets:\n${missing.join('\n')}`);
  }
  console.log(`  [PASS] ${directory || 'tiles'}: ${ids.length} referenced sprites`);
}

for (const category of ['letter', 'box', 'parcel', 'delicate']) {
  for (let frame = 0; frame < 5; frame++) {
    await access(new URL(`../tileArt/sorting/${category}_${frame}.png`, import.meta.url));
    checked++;
  }
}
console.log('  [PASS] sorting: 20 referenced sprites');

if (resourceSprites.getDrawSize('berry_bush') !== 12 ||
    resourceSprites.getDrawSize('copper_node') !== 12 ||
    resourceSprites.getDrawSize('wood_oak') !== 24 ||
    resourceSprites.getDrawSize('flax_plant') !== 64) {
  throw new Error('Resource draw-size categories are incorrect');
}
console.log('  [PASS] resource draw sizes: compact nodes 12px, trees 24px');

console.log(`\n  Results: ${checked} assets checked, 0 missing`);
