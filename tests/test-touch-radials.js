import TouchControls from '../client/ui/TouchControls.js';
import SkillBar from '../client/ui/SkillBar.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  [PASS] ${message}`);
}

function controlsAt(width, height) {
  const touch = {
    zones: [],
    setButtonZones(zones) { this.zones = zones; },
    setButtonZoneHandler(handler) { this.handler = handler; },
    isButtonDown() { return false; },
  };
  const controls = new TouchControls({ width, height, uiScale: 1 }, touch);
  controls.show();
  return { controls, touch };
}

function zonesDoNotOverlap(zones) {
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const dx = zones[i].x - zones[j].x;
      const dy = zones[i].y - zones[j].y;
      if (Math.hypot(dx, dy) < zones[i].radius + zones[j].radius) return false;
    }
  }
  return true;
}

console.log('\nSoloHiem Touch Radial Tests');

const portrait = controlsAt(320, 568);
const primary = portrait.touch.zones.filter(zone =>
  ['action', 'interact', 'dash', 'cancel'].includes(zone.id));
assert(primary.length === 4, 'portrait HUD exposes four primary radial actions');
assert(zonesDoNotOverlap(primary), 'portrait primary action targets never overlap');
assert(portrait.touch.zones.filter(zone => zone.id !== 'touchMenu' && !primary.includes(zone)).length === 0,
  'utility shortcuts stay collapsed until requested');

portrait.touch.handler('touchMenu');
const utility = portrait.touch.zones.filter(zone =>
  ['inventory', 'questLog', 'skills', 'map', 'petTeam', 'horseAction'].includes(zone.id));
assert(utility.length === 6, 'utility hub expands into six radial shortcuts');
assert(zonesDoNotOverlap(utility), 'expanded utility targets do not overlap each other');
assert(portrait.touch.zones.every(zone =>
  zone.x - zone.radius >= 0 && zone.x + zone.radius <= 320 &&
  zone.y - zone.radius >= 0 && zone.y + zone.radius <= 568),
  'all portrait radial targets remain on screen');

portrait.touch.handler('inventory');
assert(!portrait.controls.utilityOpen, 'choosing a utility shortcut closes its radial');
portrait.controls.setSuppressed(true);
assert(portrait.touch.zones.length === 0, 'modal screens suppress gameplay controls and hitboxes');

const skillBar = new SkillBar();
skillBar.position(320 / 1.4, 568 / 1.4, true);
assert(skillBar.slotSize === 30 && skillBar.y === 42, 'phone skill strip is compact and anchored above thumb controls');
assert(skillBar.x >= 0 && skillBar.x + skillBar.slotSize * 5 + skillBar.slotGap * 4 <= 320 / 1.4,
  'phone skill strip remains inside the portrait viewport');

console.log('\n  Results: 10 passed, 0 failed');
