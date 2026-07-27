const SAVE_DIR = new URL('../../saves/players/', import.meta.url);

export default class PlayerRepository {
  constructor() {
    this.ready = false;
  }

  async init() {
    try {
      if (typeof window === 'undefined') {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(SAVE_DIR, { recursive: true });
      }
      this.ready = true;
    } catch (err) {
      console.error('[PlayerRepo] Failed to create save directory:', err.message);
    }
  }

  getPath(playerId) {
    // Sanitize: only allow alphanumeric + hyphens
    const safe = playerId.replace(/[^a-zA-Z0-9-]/g, '');
    return new URL(`${safe}.json`, SAVE_DIR);
  }

  getStorageKey(playerId) {
    return `soloheim:player:${playerId.replace(/[^a-zA-Z0-9-]/g, '')}`;
  }

  async exists(playerId) {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.getStorageKey(playerId)) !== null;
    }
    try {
      const { access } = await import('node:fs/promises');
      await access(this.getPath(playerId));
      return true;
    } catch {
      return false;
    }
  }

  async load(playerId) {
    try {
      if (typeof window !== 'undefined') {
        const data = localStorage.getItem(this.getStorageKey(playerId));
        return data ? JSON.parse(data) : null;
      }
      const { readFile } = await import('node:fs/promises');
      const data = await readFile(this.getPath(playerId), 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async save(playerId, data) {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.getStorageKey(playerId), JSON.stringify(data));
        return true;
      }
      const { writeFile } = await import('node:fs/promises');
      await writeFile(this.getPath(playerId), JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error(`[PlayerRepo] Failed to save ${playerId}:`, err.message);
      return false;
    }
  }

}
