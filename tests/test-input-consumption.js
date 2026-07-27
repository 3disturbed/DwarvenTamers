import consumePointerAction from '../client/input/consumePointerAction.js';

let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  [PASS] ${message}`);
  passed++;
}

console.log('\nSoloHiem Modal Input Tests');

const mouseActions = { action: true, screenTap: false };
consumePointerAction(mouseActions);
assert(!mouseActions.action, 'a handled mouse click cannot reach a newly opened panel');

const touchActions = { action: false, screenTap: true };
consumePointerAction(touchActions);
assert(!touchActions.screenTap, 'a handled touch tap cannot reach a newly opened panel');

const hybridActions = { action: true, screenTap: true, interact: true };
consumePointerAction(hybridActions);
assert(
  !hybridActions.action && !hybridActions.screenTap && hybridActions.interact,
  'only pointer activation is consumed',
);

console.log(`\n  Results: ${passed} passed, 0 failed`);
