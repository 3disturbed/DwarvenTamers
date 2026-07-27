import WorldMap from '../client/ui/WorldMap.js';
import { readFile } from 'node:fs/promises';

let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  [PASS] ${message}`);
  passed++;
}

console.log('\nSoloHiem Touch Map Tests');

const map = new WorldMap();
map.open({ x: 0, y: 0 });
map.handlePinchStart(100);
map.handlePinchMove(150);
assert(map.zoom === 9, 'spreading fingers zooms the map in');

map.handlePinchMove(50);
assert(map.zoom === 3, 'pinching fingers together zooms the map out');

map.zoom = 6;
map.handleScroll(1);
assert(map.zoom === 7, 'positive wheel/pinch direction zooms in consistently');

const close = map.handleClick(236, 20, 257, 457, { x: 0, y: 0 }, new Map());
assert(close?.action === 'close', 'phone map exposes a large close target');

const gameSource = await readFile(new URL('../client/Game.js', import.meta.url), 'utf-8');
const earlyMapGuard = gameSource.indexOf('// The map is a modal surface.');
const movementUpdate = gameSource.indexOf('// Client-authoritative movement:');
assert(
  earlyMapGuard >= 0 && earlyMapGuard < movementUpdate,
  'map input is suppressed before character movement',
);

console.log(`\n  Results: ${passed} passed, 0 failed`);
