import ChunkManager from './ChunkManager.js';
import ChunkStore from './ChunkStore.js';
import WorldGenerator from './generation/WorldGenerator.js';

async function readJson(url) {
  if (typeof window !== 'undefined') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
    return response.json();
  }
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(url, 'utf-8'));
}

export default class WorldManager {
  constructor(options = {}) {
    this.mode = options.mode || 'normal';
    this.biomeIndex = null;
    this.biomeDataMap = new Map();
    this.chunkManager = null;
    this.generator = null;
    this.seed = 42;
    this.saveInterval = null;
  }

  async init() {
    // Load biome index
    const dataRoot = new URL('../../data/biomes/', import.meta.url);
    this.biomeIndex = await readJson(new URL('biomeIndex.json', dataRoot));

    // Load all biome data
    for (const biome of this.biomeIndex.biomes) {
      const dir = new URL(`${biome.id}/`, dataRoot);
      const [biomeJson, tilesJson, resourcesJson, enemiesJson] = await Promise.all([
        readJson(new URL('biome.json', dir)),
        readJson(new URL('tiles.json', dir)),
        readJson(new URL('resources.json', dir)),
        readJson(new URL('enemies.json', dir)),
      ]);

      this.biomeDataMap.set(biome.id, {
        biome: biomeJson,
        tiles: tilesJson,
        resources: resourcesJson,
        enemies: enemiesJson,
      });
    }

    // Initialize world generator
    this.generator = new WorldGenerator(this.seed, this.biomeIndex, this.biomeDataMap, { mode: this.mode });

    // Initialize chunk store and manager
    const store = new ChunkStore(new URL('../../saves/chunks/', import.meta.url), this.mode);
    await store.init();
    this.chunkManager = new ChunkManager(this.generator, store);

    // Periodic save and unload (every 30 seconds)
    this.saveInterval = setInterval(async () => {
      await this.chunkManager.saveAll();
      await this.chunkManager.unloadStale();
    }, 30000);

    console.log(`[WorldManager] Initialized with seed ${this.seed}, ${this.biomeDataMap.size} biomes loaded`);
  }

  async getChunk(chunkX, chunkY) {
    return this.chunkManager.loadOrGenerate(chunkX, chunkY);
  }

  async getChunksAround(chunkX, chunkY) {
    const required = this.chunkManager.getRequiredChunks(chunkX, chunkY);
    const chunks = [];
    for (const { x, y } of required) {
      const chunk = await this.chunkManager.loadOrGenerate(x, y);
      chunks.push(chunk);
    }
    return chunks;
  }

  getBiomeAtChunk(chunkX, chunkY) {
    return this.generator.gradient.getBiomeAtChunk(chunkX, chunkY);
  }

  isInTown(chunkX, chunkY) {
    return this.generator.isInTown(chunkX, chunkY, this.biomeIndex);
  }

  async shutdown() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    await this.chunkManager.saveAll();
    console.log('[WorldManager] Shutdown complete');
  }
}
