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
const { default: CharacterPanel } = await import('../client/ui/CharacterPanel.js');
const { default: InventoryPanel } = await import('../client/ui/InventoryPanel.js');
const { default: CharacterTabContent } = await import('../client/ui/CharacterTabContent.js');
const { default: ChestPanel } = await import('../client/ui/ChestPanel.js');
const { default: PetCodexPanel } = await import('../client/ui/PetCodexPanel.js');
const { default: FishingRodPanel } = await import('../client/ui/FishingRodPanel.js');
const { default: CraftingPanel } = await import('../client/ui/CraftingPanel.js');
const { default: UpgradePanel } = await import('../client/ui/UpgradePanel.js');
const { default: SkillsPanel } = await import('../client/ui/SkillsPanel.js');
const { default: ShopPanel } = await import('../client/ui/ShopPanel.js');
const { default: QuestPanel } = await import('../client/ui/QuestPanel.js');
const { default: MailJobPanel } = await import('../client/ui/MailJobPanel.js');
const { default: AnimalPenPanel } = await import('../client/ui/AnimalPenPanel.js');

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

const inventoryContent = new InventoryPanel();
const characterContent = new CharacterTabContent();
const characterPanel = new CharacterPanel(inventoryContent, characterContent);
characterPanel.position(257, 343);
assert(
  characterPanel.x >= 0 && characterPanel.y >= 0 &&
  characterPanel.x + characterPanel.width <= 257 &&
  characterPanel.y + characterPanel.height <= 343,
  'character menu fills a phone without overflowing',
);
assert(inventoryContent._detailMode === 'drilldown', 'phone inventory uses a dedicated item detail screen');
assert(inventoryContent._visibleRows >= 8, 'phone inventory keeps a useful full-height item list');
characterPanel.position(666, 307);
assert(
  characterPanel.x === 4 && characterPanel.y === 4 &&
  characterPanel.width === 658 && characterPanel.height === 299,
  'character menu uses the full landscape phone viewport',
);

const chest = new ChestPanel();
chest.open({ entityId: 'test', chestTier: 'wooden_chest', maxSlots: 25, slots: [] });
chest.position(257, 343);
assert(chest.mobile && chest.width === 249 && chest.height === 335, 'chest uses a full-screen phone layout');
chest.visible = true;
chest.handleClick(chest.x + chest.width * 0.75, chest.y + 42, { slots: [] });
assert(chest.mobileSide === 'player', 'phone chest switches between storage and inventory tabs');
chest.open({ entityId: 'test', chestTier: 'wooden_chest', maxSlots: 25, slots: [] });
chest.position(666, 307);
assert(chest.mobile && chest.height === 299, 'chest also reflows on short landscape phones');

const codex = new PetCodexPanel();
codex.position(257, 343);
assert(codex.scale < 1 && codex.x >= 0 && codex.y >= 0, 'pet codex remains fully visible on phones');

const rodPanel = new FishingRodPanel();
rodPanel.position(257, 343);
assert(rodPanel.scale <= 1 && rodPanel.x >= 0 && rodPanel.y >= 0, 'fishing rod menu remains fully visible on phones');

for (const MenuPanel of [
  CraftingPanel,
  UpgradePanel,
  SkillsPanel,
  ShopPanel,
  QuestPanel,
  MailJobPanel,
  AnimalPenPanel,
]) {
  const menu = new MenuPanel();
  menu.position(257, 343);
  const menuWidth = menu.width ?? 257;
  assert(
    menu.x >= 0 && menu.x + menuWidth <= 257,
    `${MenuPanel.name} remains within the phone width`,
  );
}

console.log(`\n  Results: ${passed} passed, 0 failed`);
