import Component from '../Component.js';
import { EQUIP_SLOT, ITEM_DB } from '../../../shared/ItemTypes.js';
import { MAX_UPGRADE_LEVEL } from '../../../shared/UpgradeTypes.js';

export default class EquipmentComponent extends Component {
  constructor() {
    super();
    this.slots = {
      [EQUIP_SLOT.WEAPON]: null,
      [EQUIP_SLOT.HEAD]: null,
      [EQUIP_SLOT.BODY]: null,
      [EQUIP_SLOT.LEGS]: null,
      [EQUIP_SLOT.FEET]: null,
      [EQUIP_SLOT.SHIELD]: null,
      [EQUIP_SLOT.RING1]: null,
      [EQUIP_SLOT.RING2]: null,
      [EQUIP_SLOT.TOOL]: null,
    };
  }

  equip(item, extraData = null) {
    if (!item || item.type !== 'equipment') return null;
    let targetSlot = item.slot;
    // Ring fallback: if ring1 full, try ring2
    if (targetSlot === 'ring1' && this.slots.ring1 !== null && this.slots.ring2 === null) {
      targetSlot = 'ring2';
    }
    const prev = this.slots[targetSlot];
    const equipped = { ...item };
    if (extraData) Object.assign(equipped, extraData);
    // Ensure gem/upgrade fields exist
    if (equipped.gems === undefined) equipped.gems = [];
    if (equipped.upgradeLevel === undefined) equipped.upgradeLevel = 0;
    if (equipped.upgradeXp === undefined) equipped.upgradeXp = 0;
    this.slots[targetSlot] = equipped;
    return prev;
  }

  unequip(slotName) {
    const item = this.slots[slotName];
    this.slots[slotName] = null;
    return item;
  }

  getEquipped(slotName) {
    return this.slots[slotName];
  }

  serialize() {
    const data = {};
    for (const [slot, item] of Object.entries(this.slots)) {
      if (item) {
        const entry = {
          id: item.id,
          gems: item.gems || [],
          upgradeLevel: item.upgradeLevel || 0,
          upgradeXp: item.upgradeXp || 0,
        };
        if (item.rodParts) entry.rodParts = item.rodParts;
        data[slot] = entry;
      } else {
        data[slot] = null;
      }
    }
    return data;
  }

  /**
   * Restore equipment from either the current per-instance format or the
   * legacy plain-item-ID format. Invalid and mismatched entries are ignored so
   * a damaged browser save cannot inject an item into an incompatible slot.
   */
  restore(data) {
    for (const slot of Object.values(EQUIP_SLOT)) this.slots[slot] = null;
    if (!data || typeof data !== 'object') return;

    for (const slot of Object.values(EQUIP_SLOT)) {
      const saved = data[slot];
      const itemId = typeof saved === 'string' ? saved : saved?.id;
      const itemDef = ITEM_DB[itemId];
      if (!itemDef || itemDef.type !== 'equipment') continue;

      const slotMatches = itemDef.slot === slot ||
        (itemDef.slot === EQUIP_SLOT.RING1 && slot === EQUIP_SLOT.RING2);
      if (!slotMatches) continue;

      const equipped = { ...itemDef };
      if (saved && typeof saved === 'object') {
        equipped.gems = Array.isArray(saved.gems)
          ? saved.gems.filter(gemId => typeof gemId === 'string')
          : [];
        equipped.upgradeLevel = Math.max(
          0,
          Math.min(MAX_UPGRADE_LEVEL, Math.floor(Number(saved.upgradeLevel) || 0)),
        );
        equipped.upgradeXp = Math.max(0, Math.floor(Number(saved.upgradeXp) || 0));
        if (saved.rodParts && typeof saved.rodParts === 'object') {
          equipped.rodParts = { ...saved.rodParts };
        }
      } else {
        equipped.gems = [];
        equipped.upgradeLevel = 0;
        equipped.upgradeXp = 0;
      }
      this.slots[slot] = equipped;
    }
  }
}
