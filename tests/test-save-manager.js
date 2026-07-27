import {
  clearSaveData,
  createBackup,
  replaceSaveData,
  validateBackup,
} from '../client/save-manager.js';

class MemoryStorage {
  constructor(entries = {}) { this.data = new Map(Object.entries(entries)); }
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  [PASS] ${message}`);
  passed++;
}

console.log('\nSoloHiem Save Manager Tests');
const storage = new MemoryStorage({
  'soloheim:player:solo-player': '{"level":3}',
  'soloheim:chunk:0:0': '{"tiles":[]}',
  unrelated: 'keep me',
});
const backup = createBackup(storage, new Date('2026-07-27T12:00:00Z'));
assert(Object.keys(backup.data).length === 2, 'export includes only SoloHiem data');
assert(backup.exportedAt === '2026-07-27T12:00:00.000Z', 'export timestamp is stable');
assert(validateBackup(backup) === backup, 'valid backup is accepted');

const restored = new MemoryStorage({ 'soloheim:old': '{}', unrelated: 'keep me' });
replaceSaveData(restored, backup);
assert(restored.getItem('soloheim:old') === null, 'restore replaces previous save data');
assert(restored.getItem('soloheim:player:solo-player') === '{"level":3}', 'restore writes player data');
assert(restored.getItem('unrelated') === 'keep me', 'restore preserves unrelated site data');

let invalidRejected = false;
try {
  validateBackup({ format: 'soloheim-save', version: 1, data: { evil: '{}' } });
} catch {
  invalidRejected = true;
}
assert(invalidRejected, 'restore rejects entries outside the SoloHiem namespace');

clearSaveData(restored);
assert(restored.getItem('soloheim:player:solo-player') === null, 'reset clears SoloHiem data');
assert(restored.getItem('unrelated') === 'keep me', 'reset preserves unrelated site data');
console.log(`\n  Results: ${passed} passed, 0 failed`);
