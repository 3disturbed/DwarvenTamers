import EntityFactory from '../ecs/EntityFactory.js';

async function readJson(name) {
  const url = new URL(`../../data/town/${name}`, import.meta.url);
  if (typeof window !== 'undefined') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${name}: ${response.status}`);
    return response.json();
  }
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(url, 'utf-8'));
}

export default class TownManager {
  constructor() {
    this.npcs = new Map();      // npcId -> npc definition
    this.dialogs = new Map();   // dialogId -> dialog tree
    this.quests = new Map();    // questId -> quest definition
    this.shops = new Map();     // shopId -> shop definition
  }

  async init() {
    // Load NPCs
    try {
      const npcData = await readJson('npcs.json');
      for (const npc of npcData.npcs) {
        this.npcs.set(npc.id, npc);
      }
    } catch (e) {
      console.warn('[TownManager] Could not load npcs.json:', e.message);
    }

    // Load dialogs
    try {
      const dialogData = await readJson('dialogs.json');
      for (const [id, dialog] of Object.entries(dialogData.dialogs)) {
        this.dialogs.set(id, dialog);
      }
    } catch (e) {
      console.warn('[TownManager] Could not load dialogs.json:', e.message);
    }

    // Load quests
    try {
      const questData = await readJson('quests.json');
      for (const quest of questData.quests) {
        this.quests.set(quest.id, quest);
      }
    } catch (e) {
      console.warn('[TownManager] Could not load quests.json:', e.message);
    }

    // Load shops
    try {
      const shopData = await readJson('shops.json');
      for (const [id, shop] of Object.entries(shopData.shops)) {
        this.shops.set(id, shop);
      }
    } catch (e) {
      console.warn('[TownManager] Could not load shops.json:', e.message);
    }

    console.log(`[TownManager] Loaded ${this.npcs.size} NPCs, ${this.dialogs.size} dialogs, ${this.quests.size} quests, ${this.shops.size} shops`);
  }

  /**
   * Spawn all NPC entities into the entity manager
   */
  spawnNPCs(entityManager) {
    for (const [npcId, npcDef] of this.npcs) {
      const entity = EntityFactory.createNPC(npcDef);
      if (entity) {
        entityManager.add(entity);
      }
    }
    console.log(`[TownManager] Spawned ${this.npcs.size} NPC entities`);
  }

  getNPC(npcId) {
    return this.npcs.get(npcId) || null;
  }

  getDialog(dialogId) {
    return this.dialogs.get(dialogId) || null;
  }

  getQuest(questId) {
    return this.quests.get(questId) || null;
  }

  getShop(shopId) {
    return this.shops.get(shopId) || null;
  }

  getAllQuests() {
    return [...this.quests.values()];
  }
}
