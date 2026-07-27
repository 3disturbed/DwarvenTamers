globalThis.Image = class {
  set src(value) {
    this._src = value;
  }
};

const { default: SortingPanel } = await import('../client/ui/SortingPanel.js');
const { default: FishingMinigame } = await import('../client/ui/FishingMinigame.js');

let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  [PASS] ${message}`);
  passed++;
}

console.log('\nSoloHiem Responsive Minigame Tests');

const sorting = new SortingPanel();
sorting.visible = true;
sorting.active = true;
sorting.position(257, 457);

assert(sorting._layout.compact, 'sorting uses its phone layout at scaled portrait width');
assert(sorting._layout.exitLen >= 18, 'phone conveyor exits never invert');
assert(sorting._layout.beltH >= 180, 'phone conveyor retains a playable height');
assert(sorting._layout.gateButtons.length === 4, 'phone sorting exposes four touch controls');

for (const button of sorting._layout.gateButtons) {
  assert(
    button.x >= 0 && button.y >= 0 &&
    button.x + button.width <= 257 &&
    button.y + button.height <= 457,
    'sorting touch control remains inside the phone viewport',
  );
}

const firstGate = sorting._layout.gateButtons[0];
const gateResult = sorting.handleClick(
  firstGate.x + firstGate.width / 2,
  firstGate.y + firstGate.height / 2,
);
assert(gateResult?.action === 'gate' && gateResult.gate === 1, 'sorting touch controls map to gates');

sorting.position(800, 600);
assert(!sorting._layout.compact, 'sorting preserves its desktop layout');

sorting.position(457, 257);
assert(sorting._layout.compactLandscape, 'sorting uses a single-row landscape phone layout');
assert(
  sorting._layout.gateButtons.every(button =>
    button.x >= 0 && button.x + button.width <= 457 &&
    button.y >= 0 && button.y + button.height <= 257
  ),
  'landscape sorting controls remain inside the viewport',
);

sorting.position(666, 307, true);
assert(
  sorting._layout.compact && sorting._layout.compactLandscape,
  'large landscape iPhones use touch controls instead of the desktop layout',
);
assert(
  sorting._layout.gateButtons.every(button =>
    button.x >= 0 && button.x + button.width <= 666 &&
    button.y >= 0 && button.y + button.height <= 307
  ),
  'large-iPhone sorting controls remain visible',
);

const fishing = new FishingMinigame();
const portraitFishing = fishing.getLayout(257, 343);
assert(portraitFishing.compact, 'fishing uses phone-friendly controls');
assert(
  portraitFishing.x >= 0 && portraitFishing.x + portraitFishing.width <= 257 &&
  portraitFishing.y >= 0 && portraitFishing.y + portraitFishing.height <= 343,
  'fishing controls remain inside a short phone viewport',
);
assert(
  fishing.getLayout(666, 307, true).compact,
  'large landscape iPhones retain touch fishing instructions',
);

console.log(`\n  Results: ${passed} passed, 0 failed`);
