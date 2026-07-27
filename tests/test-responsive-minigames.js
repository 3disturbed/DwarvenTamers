globalThis.Image = class {
  set src(value) {
    this._src = value;
  }
};

const { default: SortingPanel } = await import('../client/ui/SortingPanel.js');
const { default: FishingMinigame } = await import('../client/ui/FishingMinigame.js');
const { default: FishmongerPanel } = await import('../client/ui/FishmongerPanel.js');
const { default: AlchemyPanel } = await import('../client/ui/AlchemyPanel.js');
const { default: PetBattlePanel } = await import('../client/ui/PetBattlePanel.js');
const { default: PvPBattlePanel } = await import('../client/ui/PvPBattlePanel.js');

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

const fishStall = new FishmongerPanel();
fishStall.position(257, 457, true);
fishStall.start({ seed: 7, duration: 180 });
assert(fishStall.scale < 1 && fishStall.x >= 0 && fishStall.y >= 0, 'Fish Stall fits a portrait phone');
const fishStationTap = fishStall.handleTouch(
  fishStall.x + (20 + 95 / 2) * fishStall.scale,
  fishStall.y + (140 + 80 / 2) * fishStall.scale,
);
assert(fishStationTap?.stationId === 'fresh_rack', 'Fish Stall stations are direct touch targets');

fishStall.position(666, 307, true);
assert(
  fishStall.x >= 0 && fishStall.y >= 0 &&
  fishStall.width * fishStall.scale <= 666 &&
  fishStall.height * fishStall.scale <= 307,
  'Fish Stall fits a landscape iPhone',
);

const alchemy = new AlchemyPanel();
alchemy.position(257, 457, true);
alchemy.start({ seed: 9, duration: 180 });
assert(alchemy.scale < 1, 'alchemy fits a portrait phone');
const heatTap = alchemy.handleTouch(
  (alchemy.x + alchemy.width / 2) * alchemy.scale,
  (alchemy.y + 390) * alchemy.scale,
);
assert(heatTap?.action === 'heat' && alchemy.isHeating, 'alchemy exposes a touch heat toggle');

alchemy.phase = 'stabilizing';
const balanceTap = alchemy.handleTouch(
  (alchemy.x + 60) * alchemy.scale,
  (alchemy.y + 390) * alchemy.scale,
);
assert(balanceTap?.direction === -1 && alchemy.pointerVelocity < 0, 'alchemy exposes touch balance controls');

for (const BattlePanel of [PetBattlePanel, PvPBattlePanel]) {
  const battle = new BattlePanel();
  battle.active = true;
  battle.teams = { a: [{}], b: [{}] };
  battle.activeUnit = { team: 'a', index: 0 };
  battle.myTeam = 'a';
  battle.isAnimating = false;
  let selected = -1;
  battle.confirm = () => { selected = battle.menuIndex; };
  const width = 257;
  const height = 457;
  const menuY = height * 0.66;
  const menuH = height - menuY - 8;
  const cellW = (width - 24) / 3;
  const cellH = (menuH - 8) / 2;
  battle.handleClick(
    12 + cellW * 1.5,
    menuY + 4 + cellH * 1.5,
    width,
    height,
    () => {},
    () => {},
  );
  assert(selected === 4, `${BattlePanel.name} uses a tappable two-row phone action grid`);
}

console.log(`\n  Results: ${passed} passed, 0 failed`);
