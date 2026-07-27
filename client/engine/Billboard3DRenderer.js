import * as THREE from 'three';
import enemySprites, { getAnimMeta } from '../entities/EnemySprites.js';
import npcSprites from '../entities/NPCSprites.js';
import playerSprites from '../entities/PlayerSprites.js';
import resourceSprites from '../entities/ResourceSprites.js';
import stationSprites from '../entities/StationSprites.js';

const MAX_PIXEL_RATIO = 2;
const CAMERA_FOV = 52;
const CAMERA_SIDE_OFFSET = 1.12;
const CAMERA_FORWARD_OFFSET = 1.28;
const CAMERA_HEIGHT = 0.36;
const CAMERA_LOOK_Y = 18;

export default class Billboard3DRenderer {
  constructor(hostCanvas) {
    this.hostCanvas = hostCanvas;
    this.enabled = this._hasWebglSupport();
    this.textureCache = new Map();
    this.pool = [];
    this.activeCount = 0;
    this.frameTick = 0;

    if (!this.enabled) return;

    this.canvas = document.createElement('canvas');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 5000);

    this.ambient = new THREE.AmbientLight(0x9eb4cf, 0.64);
    this.sun = new THREE.DirectionalLight(0xfff1db, 0.9);
    this.sun.position.set(160, 320, 220);
    this.rim = new THREE.DirectionalLight(0x6f8ec9, 0.28);
    this.rim.position.set(-220, 170, -180);

    this.scene.add(this.ambient);
    this.scene.add(this.sun);
    this.scene.add(this.rim);

    this.groundCanvas = document.createElement('canvas');
    this.groundCtx = this.groundCanvas.getContext('2d');
    this.groundTexture = new THREE.CanvasTexture(this.groundCanvas);
    this.groundTexture.magFilter = THREE.NearestFilter;
    this.groundTexture.minFilter = THREE.NearestFilter;
    this.groundTexture.generateMipmaps = false;
    this.groundTexture.colorSpace = THREE.SRGBColorSpace;
    const groundMat = new THREE.MeshBasicMaterial({ map: this.groundTexture });
    this.groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = 0;
    this.scene.add(this.groundMesh);

    this.planeGeometry = new THREE.PlaneGeometry(1, 1);

    this.lastSize = { w: 0, h: 0, dpr: 1 };
    this._resizeFromHost();
    window.addEventListener('resize', () => this._resizeFromHost());
  }

  _hasWebglSupport() {
    try {
      const probe = document.createElement('canvas');
      const gl2 = probe.getContext('webgl2');
      const gl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
      return !!(gl2 || gl);
    } catch {
      return false;
    }
  }

  _resizeFromHost() {
    if (!this.enabled) return;
    const rect = this.hostCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === this.lastSize.w && h === this.lastSize.h && dpr === this.lastSize.dpr) return;

    this.lastSize = { w, h, dpr };
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.groundCanvas.width = w;
    this.groundCanvas.height = h;
  }

  beginFrame(gameCamera) {
    if (!this.enabled) return;
    this._resizeFromHost();

    this.frameTick = Date.now();
    this.activeCount = 0;

    const zoom = Math.max(0.4, gameCamera.zoom || 1);
    const targetX = gameCamera.x;
    const targetZ = gameCamera.y;
    const distance = 420 / zoom;

    this.camera.position.set(
      targetX - distance * CAMERA_SIDE_OFFSET,
      distance * CAMERA_HEIGHT,
      targetZ + distance * CAMERA_FORWARD_OFFSET,
    );
    this.camera.lookAt(targetX, CAMERA_LOOK_Y, targetZ);

    this.sun.position.set(
      this.camera.position.x + 160,
      this.camera.position.y + 220,
      this.camera.position.z + 130,
    );
  }

  updateGround(gameCamera, drawGround) {
    if (!this.enabled) return;

    const w = this.groundCanvas.width;
    const h = this.groundCanvas.height;
    const ctx = this.groundCtx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#161726';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(gameCamera.zoom, gameCamera.zoom);
    ctx.translate(-gameCamera.x, -gameCamera.y);
    drawGround(ctx, w, h);
    ctx.restore();

    this.groundTexture.needsUpdate = true;

    const worldW = w / Math.max(0.001, gameCamera.zoom);
    const worldH = h / Math.max(0.001, gameCamera.zoom);
    this.groundMesh.scale.set(worldW, worldH, 1);
    this.groundMesh.position.set(gameCamera.x, 0, gameCamera.y);
  }

  render(data) {
    if (!this.enabled) return;

    this._renderResources(data.resources);
    this._renderStations(data.stations);
    this._renderNpcs(data.npcs);
    this._renderEnemies(data.enemies);
    this._renderPlayers(data);

    for (let i = this.activeCount; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  composite(ctx, width, height) {
    if (!this.enabled) return;
    ctx.drawImage(this.canvas, 0, 0, width, height);
  }

  _renderPlayers(data) {
    const localPlayer = data.localPlayer;

    for (const player of data.remotePlayers.values()) {
      if (player.mounted) {
        this._renderHorse(player.x, player.y + 6, player.isMoving || false, player.facingRight || false);
      }
      this._renderPlayerSprite(player.x, player.y - (player.mounted ? 8 : 0), player.color, player.isMoving || false);
    }

    if (data.hasHorse && !data.mounted && data.followHorse?.initialized && localPlayer) {
      this._renderHorse(data.followHorse.x, data.followHorse.y, data.followHorse.isMoving || false, data.followHorse.facingRight || false);
    }

    if (localPlayer) {
      const isMoving = data.localMoving;
      if (data.mounted) {
        this._renderHorse(localPlayer.x, localPlayer.y + 6, isMoving, data.localFacingRight);
      }
      this._renderPlayerSprite(localPlayer.x, localPlayer.y - (data.mounted ? 8 : 0), localPlayer.color, isMoving);
    }
  }

  _renderPlayerSprite(x, y, color, isMoving) {
    const frameIndex = (isMoving && playerSprites.frameCount > 1)
      ? Math.floor((this.frameTick / 200) % playerSprites.frameCount)
      : 0;
    const frame = playerSprites.getFrame(color, frameIndex);
    if (!frame) return;

    const cacheKey = `player:${color}:${frameIndex}`;
    const texture = this._getFrameTexture(frame.sheet, frame.sx, frame.sy, frame.sw, frame.sh, cacheKey);
    this._placeBillboard(texture, x, y, 24, 0);
  }

  _renderHorse(x, y, isMoving, facingRight) {
    const sprite = enemySprites.get('wild_horse');
    if (!sprite) return;

    const animMeta = getAnimMeta(sprite);
    let sx = 0;
    let sw = sprite.naturalWidth;
    let sh = sprite.naturalHeight;
    let frameIdx = 0;

    if (animMeta) {
      frameIdx = isMoving ? Math.floor((this.frameTick / 150) % animMeta.frames) : 0;
      sx = frameIdx * animMeta.frameWidth;
      sw = animMeta.frameWidth;
      sh = animMeta.frameHeight;
    }

    const cacheKey = `enemy:wild_horse:${frameIdx}:${facingRight ? 1 : 0}`;
    const texture = this._getFrameTexture(sprite, sx, 0, sw, sh, cacheKey, facingRight);
    this._placeBillboard(texture, x, y, 32, 0);
  }

  _renderEnemies(enemies) {
    for (const enemy of enemies.values()) {
      const sprite = enemy.enemyId ? enemySprites.get(enemy.enemyId) : null;
      if (!sprite) continue;

      const animMeta = getAnimMeta(sprite);
      let sx = 0;
      let sw = sprite.naturalWidth;
      let sh = sprite.naturalHeight;
      let frameIdx = 0;

      if (animMeta) {
        const isMoving = enemy.aiState === 'patrol' || enemy.aiState === 'chase' || enemy.aiState === 'flee';
        frameIdx = isMoving ? Math.floor((this.frameTick / 150) % animMeta.frames) : 0;
        sx = frameIdx * animMeta.frameWidth;
        sw = animMeta.frameWidth;
        sh = animMeta.frameHeight;
      }

      const cacheKey = `enemy:${enemy.enemyId}:${frameIdx}:${enemy.facingRight ? 1 : 0}`;
      const texture = this._getFrameTexture(sprite, sx, 0, sw, sh, cacheKey, enemy.facingRight || false);
      this._placeBillboard(texture, enemy.x, enemy.y, (enemy.size || 24) * 2, enemy.isBoss ? 5 : 0);
    }
  }

  _renderResources(resources) {
    for (const res of resources.values()) {
      const sprite = res.resourceId ? resourceSprites.get(res.resourceId) : null;
      if (!sprite) continue;
      const drawSize = res.resourceId
        ? resourceSprites.getDrawSize(res.resourceId)
        : (res.size || 24);
      const texture = this._getTexture(sprite, `resource:${res.resourceId}`);
      this._placeBillboard(texture, res.x, res.y, drawSize, 0);
    }
  }

  _renderStations(stations) {
    for (const station of stations.values()) {
      const sprite = station.stationId ? stationSprites.get(station.stationId) : null;
      if (!sprite) continue;
      const texture = this._getTexture(sprite, `station:${station.stationId}`);
      this._placeBillboard(texture, station.x, station.y, station.size || 40, 0);
    }
  }

  _renderNpcs(npcs) {
    for (const npc of npcs.values()) {
      const sprite = npc.npcType ? npcSprites.get(npc.npcType) : null;
      if (!sprite) continue;
      const texture = this._getTexture(sprite, `npc:${npc.npcType}`);
      this._placeBillboard(texture, npc.x, npc.y, (npc.size || 26) * 1.6, 0);
    }
  }

  _getTexture(image, key) {
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const texture = new THREE.Texture(image);
    texture.needsUpdate = true;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textureCache.set(key, texture);
    return texture;
  }

  _getFrameTexture(image, sx, sy, sw, sh, key, flipX = false) {
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = sw;
    frameCanvas.height = sh;
    const frameCtx = frameCanvas.getContext('2d');

    if (flipX) {
      frameCtx.translate(sw, 0);
      frameCtx.scale(-1, 1);
    }

    frameCtx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

    const texture = new THREE.CanvasTexture(frameCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textureCache.set(key, texture);
    return texture;
  }

  _placeBillboard(texture, worldX, worldY, size, liftY = 0) {
    const mesh = this._acquireMesh(texture);

    mesh.visible = true;
    mesh.scale.set(size, size, 1);
    mesh.position.set(worldX, (size * 0.46) + liftY, worldY);

    // Cylindrical billboarding: only yaw, so sprites stay upright and stop wobbling.
    const dx = this.camera.position.x - mesh.position.x;
    const dz = this.camera.position.z - mesh.position.z;
    mesh.rotation.set(0, Math.atan2(dx, dz), 0);
    mesh.material.opacity = 1;
  }

  _acquireMesh(texture) {
    let mesh = this.pool[this.activeCount];
    if (!mesh) {
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.28,
        side: THREE.DoubleSide,
      });
      mesh = new THREE.Mesh(this.planeGeometry, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.pool.push(mesh);
      this.scene.add(mesh);
    }

    if (mesh.material.map !== texture) {
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
    }

    this.activeCount += 1;
    return mesh;
  }
}
