import {
  getTamerEncounterScaling,
  getTamerXpForLevel,
  getTamerXpReward,
  isFreePetHealing,
} from '../shared/PetTypes.js';

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  [PASS] ${message}`);
  passed++;
}

console.log('\nSoloHiem Tamer Progression Tests');

const beginner = getTamerEncounterScaling(0, 1);
assert(beginner.count[0] === 1 && beginner.count[1] === 1, 'level 1 tamer faces one meadow creature');
assert(beginner.minLevel === 1 && beginner.maxLevel === 1, 'first meadow fights use level 1 enemies');
assert(getTamerEncounterScaling(0, 7).count[1] === 2, 'novice assistance tapers before level 10');
assert(getTamerEncounterScaling(0, 10).count[0] === 2, 'normal meadow encounters begin at tamer level 10');
assert(getTamerEncounterScaling(1, 1).assisted === false, 'higher-biome encounters retain their intended challenge');
assert(isFreePetHealing(9) && !isFreePetHealing(10), 'pet healing is free only below tamer level 10');
assert(getTamerXpForLevel(2) === 20, 'first tamer level has a clear XP threshold');
assert(getTamerXpReward([{ petId: 'rabbit', level: 1 }]) === 5, 'a beginner victory awards useful tamer XP');

console.log(`\n  Results: ${passed} passed, 0 failed`);
