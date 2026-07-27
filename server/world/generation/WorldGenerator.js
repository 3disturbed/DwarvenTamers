import NoiseGenerator from './NoiseGenerator.js';
import GradientResolver from './GradientResolver.js';
import TerrainGenerator from './TerrainGenerator.js';
import ResourcePlacer from './ResourcePlacer.js';
import EnemySpawner from './EnemySpawner.js';
import CaveGenerator from './CaveGenerator.js';
import RiverGenerator from './RiverGenerator.js';
import TownTerrainOverlay from './TownTerrainOverlay.js';
import { CHUNK_SIZE, TILE_SIZE } from '../../../shared/Constants.js';
import { TILE } from '../../../shared/TileTypes.js';
import { STATION_DB } from '../../../shared/StationTypes.js';
import { ITEM_DB } from '../../../shared/ItemTypes.js';

export default class WorldGenerator {
  constructor(seed, biomeIndex, biomeDataMap, options = {}) {
    this.seed = seed;
    this.mode = options.mode || 'normal';
    this.noise = new NoiseGenerator(seed);
    this.gradient = new GradientResolver(biomeIndex);
    this.terrain = new TerrainGenerator(this.noise);
    this.resources = new ResourcePlacer(this.noise, this.gradient);
    this.enemies = new EnemySpawner(this.noise, this.gradient);
    this.caves = new CaveGenerator(this.noise);
    this.rivers = new RiverGenerator(this.noise, biomeIndex);
    this.biomeDataMap = biomeDataMap; // biomeId -> {biome.json, tiles.json, resources.json, enemies.json}
    this.townOverlay = new TownTerrainOverlay(biomeIndex);
    this.biomeIndex = biomeIndex;

    // Generate persistent river network once at startup
    this.rivers.generateRiverMap();
  }

  generateChunk(chunkX, chunkY) {
    const biome = this.gradient.getBiomeAtChunk(chunkX, chunkY);
    const biomeData = this.biomeDataMap.get(biome.id);

    if (!biomeData) {
      console.warn(`[WorldGen] No data for biome: ${biome.id}, using fallback`);
      return this.generateFallbackChunk(chunkX, chunkY);
    }

    // Generate terrain tiles
    const { tiles, solids } = this.terrain.generateChunkTiles(
      chunkX, chunkY, biomeData.biome, biomeData.tiles
    );

    // Apply cave generation (skip in town)
    const inTown = this.isInTown(chunkX, chunkY, this.biomeIndex);
    if (!inTown) {
      this.caves.generateCaves(chunkX, chunkY, biomeData, tiles, solids);
    }

    // Apply rivers/lakes (after terrain + caves, before town overlay)
    if (!inTown) {
      this.rivers.applyWater(chunkX, chunkY, tiles, solids);
    }

    // Apply town wall/road overlay for chunks near town
    if (this.mode !== 'survival' && this.townOverlay.chunkNeedOverlay(chunkX, chunkY)) {
      this.townOverlay.applyOverlay(chunkX, chunkY, tiles, solids);
    }

    // Place resources (skip in town to keep it clean)
    const resources = inTown ? [] : this.resources.placeResources(
      chunkX, chunkY, biome, biomeData.resources, solids, tiles
    );

    // Place random cave chests with biome-themed loot.
    const structures = inTown ? [] : this.generateCaveChests(
      chunkX, chunkY, biome, biomeData, tiles, solids, resources
    );

    // Determine enemy spawn points
    const spawnPoints = this.enemies.getSpawnPoints(
      chunkX, chunkY, biome, biomeData.enemies, solids, tiles
    );

    return {
      chunkX,
      chunkY,
      biomeId: biome.id,
      tiles,
      solids,
      resources,
      spawnPoints,
      structures,
      generated: true,
    };
  }

  generateFallbackChunk(chunkX, chunkY) {
    const tiles = new Array(256).fill(0); // grass
    const solids = new Array(256).fill(false);
    return {
      chunkX,
      chunkY,
      biomeId: 'meadow',
      tiles,
      solids,
      resources: [],
      spawnPoints: [],
      structures: [],
      generated: true,
    };
  }

  generateCaveChests(chunkX, chunkY, biome, biomeData, tiles, solids, resources) {
    if (!biomeData?.biome?.cave || !Array.isArray(tiles) || !Array.isArray(solids)) return [];

    const candidates = [];
    const baseWorldX = chunkX * CHUNK_SIZE * TILE_SIZE;
    const baseWorldY = chunkY * CHUNK_SIZE * TILE_SIZE;

    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const idx = ty * CHUNK_SIZE + tx;
        if (solids[idx]) continue;
        const t = tiles[idx];
        const isCaveFloor = t === TILE.CAVE_FLOOR || t === TILE.CAVE_MOSS || t === TILE.CAVE_CRYSTAL;
        if (!isCaveFloor) continue;

        const x = baseWorldX + tx * TILE_SIZE + TILE_SIZE / 2;
        const y = baseWorldY + ty * TILE_SIZE + TILE_SIZE / 2;
        if (this._isNearResource(x, y, resources, TILE_SIZE * 1.25)) continue;

        candidates.push({ x, y });
      }
    }

    if (candidates.length < 8) return [];

    const caveCoverage = candidates.length / (CHUNK_SIZE * CHUNK_SIZE);
    const configuredChance = biomeData.biome.cave.chestChance;
    const chestChance = typeof configuredChance === 'number'
      ? configuredChance
      : Math.min(0.4, 0.04 + caveCoverage * 0.6);
    const firstRoll = this._chunkRand(chunkX, chunkY, 11);
    if (firstRoll > chestChance) return [];

    const biomeTier = biomeData.biome.tier || biome.tier || 1;
    const stationId = this._getCaveChestStationId(biomeTier);
    const chestDef = STATION_DB[stationId];
    if (!chestDef || !chestDef.isChest) return [];

    const structures = [];
    const used = [];
    const secondChance = Math.min(0.15, caveCoverage * 0.25);
    const chestCount = 1 + (this._chunkRand(chunkX, chunkY, 12) < secondChance ? 1 : 0);

    for (let n = 0; n < chestCount; n++) {
      const pos = this._pickCaveChestPosition(candidates, used, chunkX, chunkY, 20 + n);
      if (!pos) continue;
      used.push(pos);

      structures.push({
        stationId,
        x: pos.x,
        y: pos.y,
        level: 1,
        isChest: true,
        chest: this._generateCaveChestInventory(chunkX, chunkY, biomeData, chestDef, biomeTier, n),
        placedBy: null,
        isTownStation: false,
        generatedCaveLoot: true,
      });
    }

    return structures;
  }

  _isNearResource(x, y, resources, minDist) {
    const minDistSq = minDist * minDist;
    for (const r of resources || []) {
      const dx = x - r.x;
      const dy = y - r.y;
      if ((dx * dx + dy * dy) < minDistSq) return true;
    }
    return false;
  }

  _pickCaveChestPosition(candidates, used, chunkX, chunkY, salt) {
    if (!candidates.length) return null;

    const minDistSq = (TILE_SIZE * 3) * (TILE_SIZE * 3);
    const start = Math.floor(this._chunkRand(chunkX, chunkY, salt) * candidates.length);

    for (let i = 0; i < candidates.length; i++) {
      const idx = (start + i) % candidates.length;
      const c = candidates[idx];
      let tooClose = false;
      for (const u of used) {
        const dx = c.x - u.x;
        const dy = c.y - u.y;
        if ((dx * dx + dy * dy) < minDistSq) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) return c;
    }
    return null;
  }

  _getCaveChestStationId(biomeTier) {
    if (biomeTier >= 5) return 'obsidian_vault';
    if (biomeTier >= 4) return 'iron_chest';
    if (biomeTier >= 2) return 'reinforced_chest';
    return 'wooden_chest';
  }

  _buildBiomeLootPools(resourceJson) {
    const orePool = [];
    const otherPool = [];

    for (const entry of resourceJson?.resources || []) {
      for (const drop of entry.drops || []) {
        if (!drop?.item || !ITEM_DB[drop.item]) continue;
        const item = drop.item;
        const min = Math.max(1, drop.min ?? 1);
        const max = Math.max(min, drop.max ?? min);
        const chance = typeof drop.chance === 'number' ? drop.chance : 1;
        const weight = (entry.caveOnly ? 1.8 : 1.0) * (0.4 + chance);
        const poolEntry = { item, min, max, chance, weight };
        if (item.endsWith('_ore')) orePool.push(poolEntry);
        else otherPool.push(poolEntry);
      }
    }

    return { orePool, otherPool };
  }

  _pickWeighted(pool, rand) {
    if (!pool.length) return null;
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let target = rand * total;
    for (const entry of pool) {
      target -= entry.weight;
      if (target <= 0) return entry;
    }
    return pool[pool.length - 1];
  }

  _addToChestSlots(slots, maxSlots, itemId, count) {
    const def = ITEM_DB[itemId];
    if (!def || count <= 0) return;

    let remaining = count;
    if (def.stackable) {
      for (let i = 0; i < maxSlots && remaining > 0; i++) {
        const slot = slots[i];
        if (slot && slot.itemId === itemId) {
          const maxStack = def.maxStack || 99;
          const canAdd = Math.min(remaining, maxStack - slot.count);
          if (canAdd > 0) {
            slot.count += canAdd;
            remaining -= canAdd;
          }
        }
      }
    }

    for (let i = 0; i < maxSlots && remaining > 0; i++) {
      if (slots[i]) continue;
      if (def.stackable) {
        const add = Math.min(remaining, def.maxStack || 99);
        slots[i] = { itemId, count: add };
        remaining -= add;
      } else {
        slots[i] = { itemId, count: 1 };
        remaining--;
      }
    }
  }

  _generateCaveChestInventory(chunkX, chunkY, biomeData, chestDef, biomeTier, chestIndex) {
    const maxSlots = chestDef.chestSlots || 20;
    const slots = new Array(maxSlots).fill(null);
    const { orePool, otherPool } = this._buildBiomeLootPools(biomeData.resources);

    let salt = 100 + chestIndex * 31;

    // Guarantee ore in each cave chest when the biome defines ore drops.
    const ore = this._pickWeighted(orePool, this._chunkRand(chunkX, chunkY, salt++));
    if (ore) {
      const base = this._randInt(ore.min, ore.max, chunkX, chunkY, salt++);
      const bonus = Math.max(0, biomeTier - 1);
      this._addToChestSlots(slots, maxSlots, ore.item, base + bonus);
    }

    const extrasPool = otherPool.length ? otherPool : orePool;
    const extraCount = this._randInt(2, 4, chunkX, chunkY, salt++);
    for (let i = 0; i < extraCount; i++) {
      const entry = this._pickWeighted(extrasPool, this._chunkRand(chunkX, chunkY, salt++));
      if (!entry) continue;

      const chanceRoll = this._chunkRand(chunkX, chunkY, salt++);
      const effectiveChance = Math.min(1, Math.max(0.2, entry.chance * 1.35));
      if (chanceRoll > effectiveChance) continue;

      const amount = this._randInt(entry.min, entry.max, chunkX, chunkY, salt++);
      this._addToChestSlots(slots, maxSlots, entry.item, amount);
    }

    return {
      chestTier: chestDef.id,
      maxSlots,
      slots,
    };
  }

  _chunkRand(chunkX, chunkY, salt) {
    return this.noise.seededRandom(chunkX * 7919 + salt * 97, chunkY * 1543 + salt * 389);
  }

  _randInt(min, max, chunkX, chunkY, salt) {
    const lo = Math.floor(min);
    const hi = Math.floor(max);
    return lo + Math.floor(this._chunkRand(chunkX, chunkY, salt) * (hi - lo + 1));
  }

  // Check if position is in town safe zone
  isInTown(chunkX, chunkY, biomeIndex) {
    if (this.mode === 'survival') return false;
    const townX = biomeIndex.townChunkX || 0;
    const townY = biomeIndex.townChunkY || 0;
    const townR = biomeIndex.townRadius || 5;
    const dx = chunkX - townX;
    const dy = chunkY - townY;
    return (dx * dx + dy * dy) <= (townR * townR);
  }
}
