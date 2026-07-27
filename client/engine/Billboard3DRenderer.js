import * as THREE from 'three';
import enemySprites, { getAnimMeta } from '../entities/EnemySprites.js';
import npcSprites from '../entities/NPCSprites.js';
import playerSprites from '../entities/PlayerSprites.js';
import resourceSprites from '../entities/ResourceSprites.js';
import stationSprites from '../entities/StationSprites.js';
import tileSprites from '../world/TileSprites.js';
import { CHUNK_SIZE, TILE_SIZE } from '../../shared/Constants.js';
import { TILE } from '../../shared/TileTypes.js';

const MAX_PIXEL_RATIO = 2;
const CAMERA_FOV = 58;
const CAMERA_SIDE_OFFSET = 0;
const CAMERA_PITCH_DEG = 70;
const CAMERA_ORBIT_DISTANCE = 420;
const CAMERA_LOOK_Y = 18;
const CAMERA_NEAR = 2;
const CAMERA_FAR_BASE = 5200;
const CAMERA_FOLLOW_DAMPING = 1;
const CAMERA_POSITION_DAMPING = 1;
const DAY_CYCLE_MS = 120000;
const GROUND_OVERSCAN = 1.8;
const BILLBOARD_PITCH_DEG = -33;
const STARTUP_FADE_MS = 850;
const MAX_WALL_INSTANCES = 12000;
const WALL_BASE_HEIGHT = TILE_SIZE * 0.75;
const SUN_NORTH_OFFSET_Z = -320;
const SUN_HEIGHT = 300;

const WALL_TILE_IDS = new Set([
  TILE.WALL,
  TILE.CAVE_WALL,
  TILE.CLIFF,
]);

const TREE_RESOURCE_IDS = new Set([
  'wood_oak',
  'wood_pine',
  'wood_dark_oak',
  'ancient_tree',
  'frost_pine',
]);

export default class Billboard3DRenderer {
  constructor(hostCanvas) {
    this.hostCanvas = hostCanvas;
    this.enabled = this._hasWebglSupport();
    this.textureCache = new Map();
    this.pool = [];
    this.shadowPool = [];
    this.activeCount = 0;
    this.activeShadowCount = 0;
    this.frameTick = 0;
    this.startupFadeAlpha = 1;
    this.startupFadeStarted = false;
    this.startupFadeStartMs = 0;

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
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR_BASE);

    this.ambient = new THREE.AmbientLight(0x9eb4cf, 0.64);
    this.sun = new THREE.DirectionalLight(0xfff1db, 0.9);
    this.sun.position.set(0, SUN_HEIGHT, SUN_NORTH_OFFSET_Z);
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
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

    this.shadowTexture = this._createShadowTexture();
    this.resourceShadowTexture = this._createResourceShadowTexture() || this.shadowTexture;
    this.wallTexture = this._createWallTileTexture();

    this.wallGeometry = new THREE.BoxGeometry(TILE_SIZE, 1, TILE_SIZE);
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.wallTexture,
      roughness: 0.95,
      metalness: 0.02,
    });
    this.wallMesh = new THREE.InstancedMesh(this.wallGeometry, this.wallMaterial, MAX_WALL_INSTANCES);
    this.wallMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wallMesh.frustumCulled = false;
    this.wallMesh.count = 0;
    this.scene.add(this.wallMesh);
    this._wallMatrix = new THREE.Matrix4();
    this._wallPos = new THREE.Vector3();
    this._wallQuat = new THREE.Quaternion();
    this._wallScale = new THREE.Vector3(1, 1, 1);

    this.smoothedFocus = new THREE.Vector3();
    this.smoothedCameraPos = new THREE.Vector3();
    this.cameraStateInitialized = false;

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

    this.groundCanvas.width = Math.max(1, Math.round(w * GROUND_OVERSCAN));
    this.groundCanvas.height = Math.max(1, Math.round(h * GROUND_OVERSCAN));
  }

  beginFrame(gameCamera) {
    if (!this.enabled) return;
    this._resizeFromHost();

    this.frameTick = Date.now();
    this.activeCount = 0;
    this.activeShadowCount = 0;

    const zoom = Math.max(0.4, gameCamera.zoom || 1);
    const targetX = gameCamera.x;
    const targetZ = gameCamera.y;
    const distance = CAMERA_ORBIT_DISTANCE / zoom;
    const pitchRad = (CAMERA_PITCH_DEG * Math.PI) / 180;
    const horizontalOffset = Math.cos(pitchRad) * distance;
    const verticalOffset = Math.sin(pitchRad) * distance;

    const desiredPos = new THREE.Vector3(
      targetX - distance * CAMERA_SIDE_OFFSET,
      verticalOffset,
      targetZ + horizontalOffset,
    );
    const desiredFocus = new THREE.Vector3(targetX, 0, targetZ);

    if (!this.cameraStateInitialized) {
      this.smoothedCameraPos.copy(desiredPos);
      this.smoothedFocus.copy(desiredFocus);
      this.cameraStateInitialized = true;
    } else {
      this.smoothedCameraPos.lerp(desiredPos, CAMERA_POSITION_DAMPING);
      this.smoothedFocus.lerp(desiredFocus, CAMERA_FOLLOW_DAMPING);
    }

    this.camera.position.copy(this.smoothedCameraPos);
    this.camera.lookAt(this.smoothedFocus.x, CAMERA_LOOK_Y, this.smoothedFocus.z);

    // Keep clipping stable across zoom: tighter at close zoom, broader when zoomed out.
    this.camera.near = CAMERA_NEAR;
    this.camera.far = CAMERA_FAR_BASE + (1 / zoom) * 2600;
    this.camera.updateProjectionMatrix();

    this.sun.position.set(
      this.smoothedFocus.x,
      SUN_HEIGHT,
      this.smoothedFocus.z + SUN_NORTH_OFFSET_Z,
    );
    this.sunTarget.position.set(this.smoothedFocus.x, 0, this.smoothedFocus.z);

    const phase = (this.frameTick % DAY_CYCLE_MS) / DAY_CYCLE_MS;
    const daylight = Math.max(0, Math.sin(phase * Math.PI * 2));
    const warmSun = new THREE.Color(0xffd8ae);
    const coolSun = new THREE.Color(0x88a9ff);
    const warmAmbient = new THREE.Color(0x8ea6bc);
    const coolAmbient = new THREE.Color(0x3d4f70);

    this.sun.color.copy(coolSun).lerp(warmSun, daylight);
    this.ambient.color.copy(coolAmbient).lerp(warmAmbient, daylight);
    this.rim.color.set(0x7b9ecf);

    this.sun.intensity = 0.35 + daylight * 0.95;
    this.ambient.intensity = 0.32 + daylight * 0.4;
    this.rim.intensity = 0.24 + (1 - daylight) * 0.28;
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

    this._renderWalls(data.chunks);

    this._renderResources(data.resources);
    this._renderStations(data.stations);
    this._renderNpcs(data.npcs);
    this._renderEnemies(data.enemies);
    this._renderPlayers(data);

    for (let i = this.activeCount; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }
    for (let i = this.activeShadowCount; i < this.shadowPool.length; i++) {
      this.shadowPool[i].visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  _renderWalls(chunks) {
    if (!chunks || chunks.size === 0) {
      this.wallMesh.count = 0;
      return;
    }

    const centerX = this.smoothedFocus.x;
    const centerZ = this.smoothedFocus.z;
    const cullRadius = (this.groundMesh.scale.x + this.groundMesh.scale.y) * 0.42;

    let index = 0;
    for (const chunk of chunks.values()) {
      const ox = chunk.chunkX * CHUNK_SIZE * TILE_SIZE;
      const oy = chunk.chunkY * CHUNK_SIZE * TILE_SIZE;

      for (let ty = 0; ty < CHUNK_SIZE; ty++) {
        for (let tx = 0; tx < CHUNK_SIZE; tx++) {
          const tileId = chunk.tiles[ty * CHUNK_SIZE + tx];
          if (!WALL_TILE_IDS.has(tileId)) continue;
          if (index >= MAX_WALL_INSTANCES) break;

          const wx = ox + tx * TILE_SIZE + TILE_SIZE * 0.5;
          const wz = oy + ty * TILE_SIZE + TILE_SIZE * 0.5;

          const dx = wx - centerX;
          const dz = wz - centerZ;
          if (Math.abs(dx) > cullRadius || Math.abs(dz) > cullRadius) continue;

          const height = tileId === TILE.CLIFF ? WALL_BASE_HEIGHT * 1.2 : WALL_BASE_HEIGHT;
          this._wallPos.set(wx, height * 0.5, wz);
          this._wallScale.set(1, height, 1);
          this._wallMatrix.compose(this._wallPos, this._wallQuat, this._wallScale);
          this.wallMesh.setMatrixAt(index, this._wallMatrix);
          index += 1;
        }
      }
      if (index >= MAX_WALL_INSTANCES) break;
    }

    this.wallMesh.count = index;
    this.wallMesh.instanceMatrix.needsUpdate = true;
  }

  composite(ctx, width, height) {
    if (!this.enabled) return;
    ctx.drawImage(this.canvas, 0, 0, width, height);

    if (!this.startupFadeStarted && this._areBillboardSourcesReady()) {
      this.startupFadeStarted = true;
      this.startupFadeStartMs = this.frameTick || Date.now();
    }

    if (this.startupFadeStarted && this.startupFadeAlpha > 0) {
      const elapsed = Math.max(0, (this.frameTick || Date.now()) - this.startupFadeStartMs);
      this.startupFadeAlpha = Math.max(0, 1 - (elapsed / STARTUP_FADE_MS));
    }

    if (this.startupFadeAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${this.startupFadeAlpha})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  _areBillboardSourcesReady() {
    return !!(
      enemySprites.loaded
      && npcSprites.loaded
      && playerSprites.loaded
      && resourceSprites.loaded
      && stationSprites.loaded
    );
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
      const worldY = (res.resourceId && TREE_RESOURCE_IDS.has(res.resourceId))
        ? res.y - drawSize * 0.5
        : res.y;
      const texture = this._getTexture(sprite, `resource:${res.resourceId}`);
      this._placeBillboard(texture, res.x, worldY, drawSize, 0, {
        shadowTexture: this.resourceShadowTexture,
        shadowWorldYOffset: drawSize * 0.25,
        shadowY: 0.1,
        shadowOpacity: 0.72,
        shadowScaleX: 1.06,
        shadowScaleY: 0.74,
      });
    }
  }

  _renderStations(stations) {
    for (const station of stations.values()) {
      const sprite = station.stationId ? stationSprites.get(station.stationId) : null;
      if (!sprite) continue;
      const texture = this._getTexture(sprite, `station:${station.stationId}`);
      if (station.stationId === 'cooking_fire') {
        this._placeFlatSprite(texture, station.x, station.y, station.size || 40);
        continue;
      }
      this._placeBillboard(texture, station.x, station.y, station.size || 40, 0);
    }
  }

  _placeFlatSprite(texture, worldX, worldY, size) {
    const mesh = this._acquireMesh(texture);
    mesh.visible = true;
    mesh.scale.set(size, size, 1);
    mesh.position.set(worldX, 0.12, worldY);
    mesh.rotation.set(-Math.PI / 2, 0, 0);
    mesh.material.opacity = 1;
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

  _placeBillboard(texture, worldX, worldY, size, liftY = 0, shadowOptions = null) {
    const mesh = this._acquireMesh(texture);

    mesh.visible = true;
    mesh.scale.set(size, size, 1);
    mesh.position.set(worldX, (size * 0.46) + liftY, worldY);

    // Keep a fixed billboard pitch and locked yaw.
    mesh.rotation.set((BILLBOARD_PITCH_DEG * Math.PI) / 180, 0, 0);
    mesh.material.opacity = 1;

    this._placeShadow(worldX, worldY, size, liftY, shadowOptions);
  }

  _placeShadow(worldX, worldY, size, liftY = 0, options = null) {
    const shadow = this._acquireShadowMesh(options?.shadowTexture || null);
    shadow.visible = true;
    shadow.position.set(worldX, options?.shadowY ?? 0.06, worldY + (options?.shadowWorldYOffset ?? 0));
    shadow.rotation.set(-Math.PI / 2, 0, 0);
    const scale = size * (0.8 + Math.max(0, liftY) * 0.01);
    const sx = options?.shadowScaleX ?? 1;
    const sy = options?.shadowScaleY ?? 0.68;
    shadow.scale.set(scale * sx, scale * sy, 1);
    const defaultOpacity = Math.max(0.18, 0.36 - Math.max(0, liftY) * 0.02);
    shadow.material.opacity = options?.shadowOpacity ?? defaultOpacity;
  }

  _createShadowTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0,0,0,0.56)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.26)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }

  _createWallTileTexture() {
    const source = tileSprites.get(TILE.FLOOR_STONE)
      || tileSprites.get(TILE.STONE)
      || tileSprites.get(TILE.GRASS);

    if (!source) return null;

    const c = document.createElement('canvas');
    c.width = TILE_SIZE;
    c.height = TILE_SIZE;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    const sx = source.width >= TILE_SIZE * 3 ? TILE_SIZE : 0;
    const sy = source.height >= TILE_SIZE * 3 ? TILE_SIZE : 0;
    g.drawImage(source, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createResourceShadowTexture() {
    if (!resourceSprites.ground) return null;
    const t = new THREE.Texture(resourceSprites.ground);
    t.needsUpdate = true;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _acquireMesh(texture) {
    let mesh = this.pool[this.activeCount];
    if (!mesh) {
      const material = new THREE.MeshBasicMaterial({
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

  _acquireShadowMesh(texture = null) {
    let shadow = this.shadowPool[this.activeShadowCount];
    if (!shadow) {
      const mat = new THREE.MeshBasicMaterial({
        map: texture || this.shadowTexture,
        transparent: true,
        depthWrite: false,
      });
      shadow = new THREE.Mesh(this.planeGeometry, mat);
      shadow.renderOrder = 1;
      this.shadowPool.push(shadow);
      this.scene.add(shadow);
    }

    const map = texture || this.shadowTexture;
    if (shadow.material.map !== map) {
      shadow.material.map = map;
      shadow.material.needsUpdate = true;
    }

    this.activeShadowCount += 1;
    return shadow;
  }
}
