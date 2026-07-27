export const RESOURCE_IDS = [
  // Meadow
  'stick_pile', 'loose_stone', 'wood_oak', 'stone_node', 'copper_node',
  'berry_bush', 'flax_plant', 'cave_copper_vein', 'cave_tin_vein',
  // Dark Forest
  'wood_pine', 'wood_dark_oak', 'tin_node', 'mushroom_cluster', 'thistle',
  'cave_iron_vein', 'cave_coal_deposit',
  // Swamp
  'ancient_tree', 'iron_deposit', 'guck_sac', 'bloodbag',
  'cave_silver_vein', 'cave_iron_scrap_pile',
  // Mountain
  'silver_vein', 'obsidian_node', 'frost_pine', 'dragon_egg',
  'cave_obsidian_vein', 'cave_crystal_cluster',
  // Volcanic
  'flametal_node', 'obsidian_large', 'surtling_core_node', 'charred_bone_pile',
  'cave_flametal_vein', 'cave_sulfite_deposit',
];

const RESOURCE_GLOW = {
  copper_node: '#df8a3f',
  cave_copper_vein: '#df8a3f',
  tin_node: '#a9d7df',
  cave_tin_vein: '#a9d7df',
  iron_deposit: '#bc7852',
  cave_iron_vein: '#bc7852',
  cave_iron_scrap_pile: '#bc7852',
  silver_vein: '#dbeaff',
  cave_silver_vein: '#dbeaff',
  obsidian_node: '#7966bf',
  obsidian_large: '#7966bf',
  cave_obsidian_vein: '#7966bf',
  cave_crystal_cluster: '#9e86ff',
  dragon_egg: '#d27dff',
  flametal_node: '#ff693d',
  cave_flametal_vein: '#ff693d',
  surtling_core_node: '#ff512e',
  cave_sulfite_deposit: '#cbd539',
  guck_sac: '#77dc58',
  bloodbag: '#e34b45',
};

const FORAGE_IDS = new Set([
  'berry_bush', 'flax_plant', 'mushroom_cluster', 'thistle',
]);

const TREE_IDS = new Set([
  'wood_oak', 'wood_pine', 'wood_dark_oak', 'ancient_tree', 'frost_pine',
]);

const COMPACT_NODE_IDS = new Set([
  'loose_stone', 'stone_node',
  'copper_node', 'tin_node', 'iron_deposit', 'silver_vein',
  'obsidian_node', 'obsidian_large', 'flametal_node',
  'cave_copper_vein', 'cave_tin_vein', 'cave_iron_vein',
  'cave_coal_deposit', 'cave_silver_vein', 'cave_iron_scrap_pile',
  'cave_obsidian_vein', 'cave_crystal_cluster', 'cave_flametal_vein',
  'cave_sulfite_deposit',
]);

const MEDIUM_NODE_IDS = new Set([
  'dragon_egg', 'guck_sac', 'bloodbag', 'surtling_core_node',
  'stick_pile', 'charred_bone_pile',
]);

class ResourceSprites {
  constructor() {
    this.sprites = {};
    this.ground = null;
    this.loaded = false;
  }

  load() {
    const total = RESOURCE_IDS.length + 1;
    let count = 0;

    return new Promise((resolve) => {
      const finishOne = () => {
        count++;
        if (count >= total) {
          this.loaded = true;
          resolve();
        }
      };

      for (const id of RESOURCE_IDS) {
        const img = new Image();
        img.onload = () => {
          this.sprites[id] = img;
          finishOne();
        };
        img.onerror = finishOne;
        img.src = new URL(`../../tileArt/resources/${id}.png`, import.meta.url).href;
      }

      const ground = new Image();
      ground.onload = () => {
        this.ground = ground;
        finishOne();
      };
      ground.onerror = finishOne;
      ground.src = new URL('../../tileArt/effects/resource_ground.png', import.meta.url).href;
    });
  }

  get(resourceId) {
    return this.sprites[resourceId] || null;
  }

  getDrawSize(resourceId) {
    // Establish a strong world-scale hierarchy. Trees tower over the 24px
    // player, while rocks, ore, and forage stay close to the ground. Every
    // resource has a bounded fallback so a missing category can never become
    // a tree-sized 64px node again.
    if (TREE_IDS.has(resourceId)) return 64;
    if (FORAGE_IDS.has(resourceId)) return 18;
    if (COMPACT_NODE_IDS.has(resourceId)) return 16;
    if (MEDIUM_NODE_IDS.has(resourceId)) return 24;
    return 20;
  }

  /**
   * Draw the shared presentation for resource nodes. Keeping this here makes
   * chunk-cached and live entity resources visually identical.
   */
  draw(ctx, resourceId, x, y, size = this.getDrawSize(resourceId)) {
    const sprite = this.get(resourceId);
    if (!sprite) return false;

    ctx.save();
    const scale = size / 64;

    // A hand-painted footprint anchors even the smallest forage sprites.
    if (this.ground) {
      ctx.globalAlpha = FORAGE_IDS.has(resourceId) ? 0.58 : 0.78;
      const groundW = Math.max(14, Math.round(72 * scale));
      const groundH = Math.max(9, Math.round(52 * scale));
      ctx.drawImage(
        this.ground,
        Math.round(x - groundW / 2),
        Math.round(y + size * 0.1),
        groundW,
        groundH
      );
      ctx.globalAlpha = 1;
    }

    const glow = RESOURCE_GLOW[resourceId];
    if (glow) {
      const glowY = y + Math.max(3, 9 * scale);
      const glowRadius = Math.max(5, 27 * scale);
      const aura = ctx.createRadialGradient(x, glowY, 1, x, glowY, glowRadius);
      aura.addColorStop(0, `${glow}42`);
      aura.addColorStop(0.55, `${glow}18`);
      aura.addColorStop(1, `${glow}00`);
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(x, glowY, glowRadius * 1.1, glowRadius * 0.74, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = glow;
      ctx.shadowBlur = Math.max(2, 5 * scale);
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = Math.max(1, 3 * scale);
    }

    const drawX = Math.round(x - size / 2);
    const drawY = Math.round(y - size / 2);
    ctx.drawImage(sprite, drawX, drawY, size, size);
    ctx.restore();
    return true;
  }
}

const resourceSprites = new ResourceSprites();
export default resourceSprites;
