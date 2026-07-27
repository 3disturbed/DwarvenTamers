import {
  CHUNK_STORE,
  getBrowserValue,
  setBrowserValue,
} from '../../shared/BrowserDatabase.js';
import { APP_STORAGE_PREFIX } from '../../shared/AppConfig.js';

export default class ChunkStore {
  constructor(savePath, mode = 'normal') {
    this.savePath = savePath;
    this.mode = mode;
    this.ready = false;
  }

  async init() {
    if (typeof window === 'undefined') {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(this.savePath, { recursive: true });
    }
    this.ready = true;
  }

  getFilePath(chunkX, chunkY) {
    return new URL(`./${this.mode}/chunk_${chunkX}_${chunkY}.json`, this.savePath);
  }

  getStorageKey(chunkX, chunkY) {
    return `${APP_STORAGE_PREFIX}chunk:${this.mode}:${chunkX}:${chunkY}`;
  }

  async load(chunkX, chunkY) {
    if (typeof window !== 'undefined') {
      const key = `${this.mode}:${chunkX},${chunkY}`;
      const stored = await getBrowserValue(CHUNK_STORE, key);
      if (stored) return stored;

      // One-time migration from the original localStorage chunk format.
      const legacyKey = this.getStorageKey(chunkX, chunkY);
      const raw = localStorage.getItem(legacyKey);
      if (!raw) return null;
      const chunk = JSON.parse(raw);
      await setBrowserValue(CHUNK_STORE, key, chunk);
      localStorage.removeItem(legacyKey);
      return chunk;
    }
    const filePath = this.getFilePath(chunkX, chunkY);
    try {
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[ChunkStore] Failed to load ${filePath}: ${err.message}`);
      return null;
    }
  }

  async save(chunkData) {
    if (!this.ready) return;
    if (typeof window !== 'undefined') {
      await setBrowserValue(
        CHUNK_STORE,
        `${this.mode}:${chunkData.chunkX},${chunkData.chunkY}`,
        chunkData,
      );
      return;
    }
    const filePath = this.getFilePath(chunkData.chunkX, chunkData.chunkY);
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(filePath, JSON.stringify(chunkData), 'utf-8');
    } catch (err) {
      console.warn(`[ChunkStore] Failed to save ${filePath}: ${err.message}`);
    }
  }

  async exists(chunkX, chunkY) {
    if (typeof window !== 'undefined') {
      const key = `${this.mode}:${chunkX},${chunkY}`;
      if (await getBrowserValue(CHUNK_STORE, key)) return true;
      return localStorage.getItem(this.getStorageKey(chunkX, chunkY)) !== null;
    }
    const { access } = await import('node:fs/promises');
    try {
      await access(this.getFilePath(chunkX, chunkY));
      return true;
    } catch {
      return false;
    }
  }
}
