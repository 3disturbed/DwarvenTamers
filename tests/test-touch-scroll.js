import TouchInput from '../client/engine/TouchInput.js';
import QuestPanel from '../client/ui/QuestPanel.js';
import MailJobPanel from '../client/ui/MailJobPanel.js';

let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  [PASS] ${message}`);
  passed++;
}

console.log('\nSoloHiem Touch Scrolling Tests');

const canvas = {
  addEventListener() {},
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 360, height: 640 };
  },
};
const touch = new TouchInput(canvas);
touch.setUiMode(true);

const preventDefault = () => {};
touch.onTouchStart({
  preventDefault,
  touches: [{ identifier: 1, clientX: 180, clientY: 300 }],
  changedTouches: [{ identifier: 1, clientX: 180, clientY: 300 }],
});
assert(!touch.leftStick.active && !touch.rightStick.active, 'panel touch is not captured by gameplay sticks');

touch.onTouchMove({
  preventDefault,
  touches: [{ identifier: 1, clientX: 180, clientY: 240 }],
  changedTouches: [{ identifier: 1, clientX: 180, clientY: 240 }],
});
const dragDelta = touch.consumeScroll();
assert(dragDelta < 0, 'dragging upward produces a scroll-down gesture');

const questPanel = new QuestPanel();
questPanel.visible = true;
questPanel.quests = Array.from({ length: 10 }, (_, i) => ({ id: i }));
questPanel.handleScroll(dragDelta);
assert(questPanel.scrollOffset > 0, 'quest lists follow the touch drag direction');

const mailPanel = new MailJobPanel();
mailPanel.visible = true;
mailPanel.height = 220;
mailPanel.available = Array.from({ length: 10 }, (_, i) => ({ npcId: i }));
mailPanel.handleScroll(dragDelta);
assert(mailPanel.scrollOffset > 0, 'mail job lists follow the touch drag direction');

touch.setUiMode(false);
assert(!touch.uiMode, 'gameplay controls resume after the panel closes');

console.log(`\n  Results: ${passed} passed, 0 failed`);
