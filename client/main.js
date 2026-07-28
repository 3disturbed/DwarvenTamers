import Game from './Game.js';
import tileSprites from './world/TileSprites.js';
import stationSprites from './entities/StationSprites.js';
import enemySprites from './entities/EnemySprites.js';
import npcSprites from './entities/NPCSprites.js';
import playerSprites from './entities/PlayerSprites.js';
import skillSprites from './entities/SkillSprites.js';
import itemSprites from './entities/ItemSprites.js';
import uiSprites from './ui/UISprites.js';
import resourceSprites from './entities/ResourceSprites.js';
import { APP_STORAGE_PREFIX } from '../shared/AppConfig.js';
import { initializePwa } from './pwa.js';
import { initializeOnboarding } from './onboarding.js';
import { initializeSaveManager } from './save-manager.js';

const BRAND_SPLASH_MS = 5000;
const GAME_MODE_KEY = `${APP_STORAGE_PREFIX}game-mode`;
const WORLD_OPTIONS_KEY = `${APP_STORAGE_PREFIX}world-options`;
const GAME_MODE_NORMAL = 'normal';
const GAME_MODE_SURVIVAL = 'survival';
const DEFAULT_WORLD_OPTIONS = {
  seed: '42',
  horseSpawnChance: 1,
  chestSpawnChance: 1,
  mobDensityMultiplier: 1.0,
  resourceDensityMultiplier: 1.0,
  caveDensityMultiplier: 1.0,
  waterAmountMultiplier: 1.0,
  hungerEnabled: true,
  sleepRequired: true,
  hungerDecayRate: 0.5,
  sleepDuration: 300,
  tiredDebuff: 20,
};
const PERFORMANCE_PRESET_KEY = `${APP_STORAGE_PREFIX}performance-preset`; 
const PERFORMANCE_PRESETS = {
  power_saver: {
    id: 'power_saver',
    label: 'Power Saver',
    frameRateCap: 30,
    renderDetail: 'low',
    use3d: true,
    maxPixelRatio: 1,
    notes: 'Lowest load. Uses the 3D renderer with a 30 FPS cap.',
  },
  meh: {
    id: 'meh',
    label: 'Meh',
    frameRateCap: 45,
    renderDetail: 'medium',
    use3d: true,
    maxPixelRatio: 1.5,
    notes: 'Balanced. 3D rendering with softer presentation.',
  },
  bea_u_tiful: {
    id: 'bea_u_tiful',
    label: 'Bea-u-tiful',
    frameRateCap: 60,
    renderDetail: 'high',
    use3d: true,
    maxPixelRatio: 2,
    notes: 'Best visual quality. Full 3D detail and shadows.',
  },
};
const DEFAULT_PERFORMANCE_PRESET = 'meh';

// DwarvenTamers has one local character and loads directly without an account screen.
initializePwa();
initializeOnboarding();
initializeSaveManager();
startGame();

function startGame() {
  const canvas = document.getElementById('game');
  const brandSplash = document.getElementById('brand-splash');
  const splashBar = document.getElementById('splash-bar');
  const splashText = document.getElementById('splash-text');
  const splash = document.getElementById('splash');
  const mainMenu = document.getElementById('main-menu');
  const playButton = document.getElementById('main-menu-play');
  const survivalButton = document.getElementById('main-menu-survival');
  const helpButton = document.getElementById('main-menu-help');
  const saveButton = document.getElementById('main-menu-save');
  const settingsButton = document.getElementById('main-menu-settings');
  const settingsDialog = document.getElementById('settings-dialog');
  const settingsClose = document.getElementById('settings-close');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsTabs = Array.from(document.querySelectorAll('.settings-tab'));
  const seedInput = document.getElementById('world-seed');
  const horseSpawnInput = document.getElementById('horse-spawn');
  const chestSpawnInput = document.getElementById('chest-spawn');
  const horseSpawnValue = document.getElementById('horse-spawn-value');
  const chestSpawnValue = document.getElementById('chest-spawn-value');
  const helpDialog = document.getElementById('help-dialog');
  const saveDialog = document.getElementById('save-dialog');
  const terrainModal = document.getElementById('terrain-customization-modal');
  const terrainStartBtn = document.getElementById('terrain-start-btn');
  const terrainResetBtn = document.getElementById('terrain-reset-btn');
  const terrainCancelBtn = document.getElementById('terrain-cancel-btn');
  let loaderReady = false;
  let brandFinished = !brandSplash;
  let brandHandoffDone = !brandSplash;
  let gameStarted = false;
  let menuShown = false;

  const loadWorldOptions = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(WORLD_OPTIONS_KEY) || 'null');
      return { ...DEFAULT_WORLD_OPTIONS, ...(saved || {}) };
    } catch {
      return { ...DEFAULT_WORLD_OPTIONS };
    }
  };

  const hasExistingSave = async (mode) => {
    return new Promise((resolve) => {
      const dbReq = indexedDB.open('dwarven-tamers-v2');
      dbReq.onerror = () => resolve(false);
      dbReq.onsuccess = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('players')) {
          resolve(false);
          return;
        }
        const tx = db.transaction('players', 'readonly');
        const store = tx.objectStore('players');
        const getReq = store.get(`${mode}:solo-player`);
        getReq.onsuccess = () => resolve(!!getReq.result);
        getReq.onerror = () => resolve(false);
      };
    });
  };

  const worldOptions = loadWorldOptions();
  const loadPerformancePreset = () => {
    const saved = localStorage.getItem(PERFORMANCE_PRESET_KEY);
    return PERFORMANCE_PRESETS[saved] ? saved : DEFAULT_PERFORMANCE_PRESET;
  };

  let performancePresetId = loadPerformancePreset();

  if (seedInput) seedInput.value = String(worldOptions.seed ?? DEFAULT_WORLD_OPTIONS.seed);
  if (horseSpawnInput) horseSpawnInput.value = String(worldOptions.horseSpawnChance ?? DEFAULT_WORLD_OPTIONS.horseSpawnChance);
  if (chestSpawnInput) chestSpawnInput.value = String(worldOptions.chestSpawnChance ?? DEFAULT_WORLD_OPTIONS.chestSpawnChance);

  const updateWorldOptionLabels = () => {
    if (horseSpawnValue && horseSpawnInput) horseSpawnValue.textContent = `${Number(horseSpawnInput.value).toFixed(1)}x`;
    if (chestSpawnValue && chestSpawnInput) chestSpawnValue.textContent = `${Number(chestSpawnInput.value).toFixed(1)}x`;
  };

  const renderPerformancePresetPanel = () => {
    const preset = PERFORMANCE_PRESETS[performancePresetId] || PERFORMANCE_PRESETS[DEFAULT_PERFORMANCE_PRESET];
    if (!settingsPanel) return;
    settingsPanel.innerHTML = `
      <h2>${preset.label}</h2>
      <p>${preset.notes}</p>
      <dl>
        <dt>Frame cap</dt><dd>${preset.frameRateCap} FPS</dd>
        <dt>Renderer</dt><dd>3D</dd>
        <dt>Detail</dt><dd>${preset.renderDetail}</dd>
      </dl>
    `;
    for (const tab of settingsTabs) {
      tab.classList.toggle('active', tab.dataset.preset === performancePresetId);
      tab.setAttribute('aria-selected', tab.dataset.preset === performancePresetId ? 'true' : 'false');
    }
  };

  const setPerformancePreset = (presetId) => {
    if (!PERFORMANCE_PRESETS[presetId]) return;
    performancePresetId = presetId;
    localStorage.setItem(PERFORMANCE_PRESET_KEY, presetId);
    renderPerformancePresetPanel();
  };

  updateWorldOptionLabels();
  renderPerformancePresetPanel();
  horseSpawnInput?.addEventListener('input', updateWorldOptionLabels);
  chestSpawnInput?.addEventListener('input', updateWorldOptionLabels);
  settingsTabs.forEach((tab) => {
    tab.addEventListener('click', () => setPerformancePreset(tab.dataset.preset));
  });

  const getLaunchOptions = () => {
    const seedText = (seedInput?.value || '').trim();
    const parsedSeed = Number.parseInt(seedText, 10);
    const options = {
      seed: Number.isFinite(parsedSeed) ? parsedSeed : Number.parseInt(DEFAULT_WORLD_OPTIONS.seed, 10),
      horseSpawnChance: Number.parseFloat(horseSpawnInput?.value || `${DEFAULT_WORLD_OPTIONS.horseSpawnChance}`),
      chestSpawnChance: Number.parseFloat(chestSpawnInput?.value || `${DEFAULT_WORLD_OPTIONS.chestSpawnChance}`),
      mobDensityMultiplier: Number.parseFloat(document.getElementById('mob-density')?.value || DEFAULT_WORLD_OPTIONS.mobDensityMultiplier),
      resourceDensityMultiplier: Number.parseFloat(document.getElementById('resource-density')?.value || DEFAULT_WORLD_OPTIONS.resourceDensityMultiplier),
      caveDensityMultiplier: Number.parseFloat(document.getElementById('cave-density')?.value || DEFAULT_WORLD_OPTIONS.caveDensityMultiplier),
      waterAmountMultiplier: Number.parseFloat(document.getElementById('water-amount')?.value || DEFAULT_WORLD_OPTIONS.waterAmountMultiplier),
    };

    if (!Number.isFinite(options.horseSpawnChance)) options.horseSpawnChance = DEFAULT_WORLD_OPTIONS.horseSpawnChance;
    if (!Number.isFinite(options.chestSpawnChance)) options.chestSpawnChance = DEFAULT_WORLD_OPTIONS.chestSpawnChance;
    if (!Number.isFinite(options.mobDensityMultiplier)) options.mobDensityMultiplier = DEFAULT_WORLD_OPTIONS.mobDensityMultiplier;
    if (!Number.isFinite(options.resourceDensityMultiplier)) options.resourceDensityMultiplier = DEFAULT_WORLD_OPTIONS.resourceDensityMultiplier;
    if (!Number.isFinite(options.caveDensityMultiplier)) options.caveDensityMultiplier = DEFAULT_WORLD_OPTIONS.caveDensityMultiplier;
    if (!Number.isFinite(options.waterAmountMultiplier)) options.waterAmountMultiplier = DEFAULT_WORLD_OPTIONS.waterAmountMultiplier;

    const saved = { ...options };
    if (currentGameMode === GAME_MODE_SURVIVAL) {
      const hungerEnabled = document.getElementById('hunger-enabled')?.checked ?? DEFAULT_WORLD_OPTIONS.hungerEnabled;
      const sleepRequired = document.getElementById('sleep-required')?.checked ?? DEFAULT_WORLD_OPTIONS.sleepRequired;
      const hungerDecayRate = Number.parseFloat(document.getElementById('hunger-decay-rate')?.value || DEFAULT_WORLD_OPTIONS.hungerDecayRate);
      const sleepDuration = Number.parseFloat(document.getElementById('sleep-duration')?.value || DEFAULT_WORLD_OPTIONS.sleepDuration);
      const tiredDebuff = Number.parseFloat(document.getElementById('tired-debuff')?.value || DEFAULT_WORLD_OPTIONS.tiredDebuff);
      saved.hungerEnabled = hungerEnabled;
      saved.sleepRequired = sleepRequired;
      saved.hungerDecayRate = hungerDecayRate;
      saved.sleepDuration = sleepDuration;
      saved.tiredDebuff = tiredDebuff;
    }

    localStorage.setItem(WORLD_OPTIONS_KEY, JSON.stringify(saved));

    return {
      ...options,
      performance: PERFORMANCE_PRESETS[performancePresetId] || PERFORMANCE_PRESETS[DEFAULT_PERFORMANCE_PRESET],
    };
  };

  const getLaunchOptionsFromModal = () => {
    const seedText = (document.getElementById('terrain-seed')?.value || '').trim();
    const parsedSeed = Number.parseInt(seedText, 10);
    const options = {
      seed: Number.isFinite(parsedSeed) ? parsedSeed : Number.parseInt(DEFAULT_WORLD_OPTIONS.seed, 10),
      horseSpawnChance: Number.parseFloat(document.getElementById('terrain-horse-spawn')?.value || `${DEFAULT_WORLD_OPTIONS.horseSpawnChance}`),
      chestSpawnChance: Number.parseFloat(document.getElementById('terrain-chest-spawn')?.value || `${DEFAULT_WORLD_OPTIONS.chestSpawnChance}`),
      mobDensityMultiplier: Number.parseFloat(document.getElementById('mob-density')?.value || DEFAULT_WORLD_OPTIONS.mobDensityMultiplier),
      resourceDensityMultiplier: Number.parseFloat(document.getElementById('resource-density')?.value || DEFAULT_WORLD_OPTIONS.resourceDensityMultiplier),
      caveDensityMultiplier: Number.parseFloat(document.getElementById('cave-density')?.value || DEFAULT_WORLD_OPTIONS.caveDensityMultiplier),
      waterAmountMultiplier: Number.parseFloat(document.getElementById('water-amount')?.value || DEFAULT_WORLD_OPTIONS.waterAmountMultiplier),
    };

    if (!Number.isFinite(options.horseSpawnChance)) options.horseSpawnChance = DEFAULT_WORLD_OPTIONS.horseSpawnChance;
    if (!Number.isFinite(options.chestSpawnChance)) options.chestSpawnChance = DEFAULT_WORLD_OPTIONS.chestSpawnChance;
    if (!Number.isFinite(options.mobDensityMultiplier)) options.mobDensityMultiplier = DEFAULT_WORLD_OPTIONS.mobDensityMultiplier;
    if (!Number.isFinite(options.resourceDensityMultiplier)) options.resourceDensityMultiplier = DEFAULT_WORLD_OPTIONS.resourceDensityMultiplier;
    if (!Number.isFinite(options.caveDensityMultiplier)) options.caveDensityMultiplier = DEFAULT_WORLD_OPTIONS.caveDensityMultiplier;
    if (!Number.isFinite(options.waterAmountMultiplier)) options.waterAmountMultiplier = DEFAULT_WORLD_OPTIONS.waterAmountMultiplier;

    const saved = { ...options };
    if (currentGameMode === GAME_MODE_SURVIVAL) {
      const hungerEnabled = document.getElementById('hunger-enabled')?.checked ?? DEFAULT_WORLD_OPTIONS.hungerEnabled;
      const sleepRequired = document.getElementById('sleep-required')?.checked ?? DEFAULT_WORLD_OPTIONS.sleepRequired;
      const hungerDecayRate = Number.parseFloat(document.getElementById('hunger-decay-rate')?.value || DEFAULT_WORLD_OPTIONS.hungerDecayRate);
      const sleepDuration = Number.parseFloat(document.getElementById('sleep-duration')?.value || DEFAULT_WORLD_OPTIONS.sleepDuration);
      const tiredDebuff = Number.parseFloat(document.getElementById('tired-debuff')?.value || DEFAULT_WORLD_OPTIONS.tiredDebuff);
      saved.hungerEnabled = hungerEnabled;
      saved.sleepRequired = sleepRequired;
      saved.hungerDecayRate = hungerDecayRate;
      saved.sleepDuration = sleepDuration;
      saved.tiredDebuff = tiredDebuff;
    }

    localStorage.setItem(WORLD_OPTIONS_KEY, JSON.stringify(saved));

    return {
      ...options,
      performance: PERFORMANCE_PRESETS[performancePresetId] || PERFORMANCE_PRESETS[DEFAULT_PERFORMANCE_PRESET],
    };
  };

  let currentGameMode = GAME_MODE_NORMAL;

  const populateTerrainModal = (mode) => {
    if (!terrainModal) return;
    
    // Populate general settings from saved world options
    const terrainSeed = document.getElementById('terrain-seed');
    const terrainHorseSpawn = document.getElementById('terrain-horse-spawn');
    const terrainChestSpawn = document.getElementById('terrain-chest-spawn');
    const mobDensity = document.getElementById('mob-density');
    const resourceDensity = document.getElementById('resource-density');
    const caveDensity = document.getElementById('cave-density');
    const waterAmount = document.getElementById('water-amount');
    
    if (terrainSeed) terrainSeed.value = worldOptions.seed ?? DEFAULT_WORLD_OPTIONS.seed;
    if (terrainHorseSpawn) terrainHorseSpawn.value = worldOptions.horseSpawnChance ?? DEFAULT_WORLD_OPTIONS.horseSpawnChance;
    if (terrainChestSpawn) terrainChestSpawn.value = worldOptions.chestSpawnChance ?? DEFAULT_WORLD_OPTIONS.chestSpawnChance;
    if (mobDensity) mobDensity.value = worldOptions.mobDensityMultiplier ?? DEFAULT_WORLD_OPTIONS.mobDensityMultiplier;
    if (resourceDensity) resourceDensity.value = worldOptions.resourceDensityMultiplier ?? DEFAULT_WORLD_OPTIONS.resourceDensityMultiplier;
    if (caveDensity) caveDensity.value = worldOptions.caveDensityMultiplier ?? DEFAULT_WORLD_OPTIONS.caveDensityMultiplier;
    if (waterAmount) waterAmount.value = worldOptions.waterAmountMultiplier ?? DEFAULT_WORLD_OPTIONS.waterAmountMultiplier;
    
    // Show/hide survival settings
    const survivalSection = document.getElementById('survival-section');
    if (survivalSection) survivalSection.hidden = (mode !== GAME_MODE_SURVIVAL);
    
    if (mode === GAME_MODE_SURVIVAL) {
      const hungerEnabled = document.getElementById('hunger-enabled');
      const sleepRequired = document.getElementById('sleep-required');
      const hungerDecayRate = document.getElementById('hunger-decay-rate');
      const sleepDuration = document.getElementById('sleep-duration');
      const tiredDebuff = document.getElementById('tired-debuff');
      
      if (hungerEnabled) hungerEnabled.checked = worldOptions.hungerEnabled ?? DEFAULT_WORLD_OPTIONS.hungerEnabled;
      if (sleepRequired) sleepRequired.checked = worldOptions.sleepRequired ?? DEFAULT_WORLD_OPTIONS.sleepRequired;
      if (hungerDecayRate) hungerDecayRate.value = worldOptions.hungerDecayRate ?? DEFAULT_WORLD_OPTIONS.hungerDecayRate;
      if (sleepDuration) sleepDuration.value = worldOptions.sleepDuration ?? DEFAULT_WORLD_OPTIONS.sleepDuration;
      if (tiredDebuff) tiredDebuff.value = worldOptions.tiredDebuff ?? DEFAULT_WORLD_OPTIONS.tiredDebuff;
    }
    
    updateTerrainLabels();
  };

  const launchGame = async (mode = GAME_MODE_NORMAL) => {
    if (gameStarted) return;
    currentGameMode = mode;
    
    const hasExisting = await hasExistingSave(mode);
    const shouldShowModal = terrainModal && !hasExisting;
    
    if (shouldShowModal) {
      mainMenu?.classList.remove('visible');
      if (mainMenu) mainMenu.hidden = true;
      populateTerrainModal(mode);
      terrainModal.showModal();
      return;
    }
    
    gameStarted = true;
    const launchOptions = getLaunchOptions();
    window.__DWARVEN_TAMERS_MODE = mode;
    window.__DWARVEN_TAMERS_WORLD_OPTIONS = launchOptions;
    localStorage.setItem(GAME_MODE_KEY, mode);
    mainMenu?.classList.remove('visible');
    if (mainMenu) mainMenu.hidden = true;
    const game = new Game(canvas, launchOptions);
    game.start();
  };

  const maybeShowMainMenu = () => {
    if (menuShown || !loaderReady || !brandFinished) return;
    menuShown = true;
    if (splashText) splashText.textContent = 'Press Play';
    if (splash) {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 700);
    }
    if (mainMenu) {
      mainMenu.hidden = false;
      requestAnimationFrame(() => mainMenu.classList.add('visible'));
    }
  };

  const handoffBrandSplash = () => {
    if (brandHandoffDone) return;
    brandHandoffDone = true;
    brandFinished = true;
    splash?.classList.remove('pre-splash-hidden');
    if (brandSplash) {
      brandSplash.classList.add('fade-out');
      window.setTimeout(() => {
        brandSplash.hidden = true;
        brandSplash.remove();
      }, 720);
    }
    maybeShowMainMenu();
  };

  if (splash) {
    splash.classList.add('pre-splash-hidden');
  }

  if (brandSplash) {
    window.setTimeout(handoffBrandSplash, BRAND_SPLASH_MS);
  }

  // Track sprite loading progress
  const loaders = [
    { name: 'Tiles', fn: () => tileSprites.load() },
    { name: 'Stations', fn: () => stationSprites.load() },
    { name: 'Enemies', fn: () => enemySprites.load() },
    { name: 'NPCs', fn: () => npcSprites.load() },
    { name: 'Players', fn: () => playerSprites.load() },
    { name: 'Skills', fn: () => skillSprites.load() },
    { name: 'Items', fn: () => itemSprites.load() },
    { name: 'UI Icons', fn: () => uiSprites.load() },
    { name: 'Resources', fn: () => resourceSprites.load() },
  ];

  let loaded = 0;
  const total = loaders.length;

  Promise.all(loaders.map(l =>
    l.fn().then(() => {
      loaded++;
      const pct = Math.round((loaded / total) * 100);
      if (splashBar) splashBar.style.width = pct + '%';
      if (splashText) splashText.textContent = `Loading ${l.name}... ${pct}%`;
    })
  )).then(() => {
    loaderReady = true;
    maybeShowMainMenu();
  });

  playButton?.addEventListener('click', () => launchGame(GAME_MODE_NORMAL));
  survivalButton?.addEventListener('click', () => launchGame(GAME_MODE_SURVIVAL));
  settingsButton?.addEventListener('click', () => settingsDialog?.showModal());
  helpButton?.addEventListener('click', () => helpDialog?.showModal());
  saveButton?.addEventListener('click', () => saveDialog?.showModal());
  settingsClose?.addEventListener('click', () => settingsDialog?.close());

  terrainStartBtn?.addEventListener('click', () => {
    gameStarted = true;
    const launchOptions = getLaunchOptionsFromModal();
    window.__DWARVEN_TAMERS_MODE = currentGameMode;
    window.__DWARVEN_TAMERS_WORLD_OPTIONS = launchOptions;
    localStorage.setItem(GAME_MODE_KEY, currentGameMode);
    terrainModal?.close();
    const game = new Game(canvas, launchOptions);
    game.start();
  });

  terrainResetBtn?.addEventListener('click', () => {
    const terrainSeed = document.getElementById('terrain-seed');
    if (terrainSeed) terrainSeed.value = DEFAULT_WORLD_OPTIONS.seed;
    
    const terrainHorseSpawn = document.getElementById('terrain-horse-spawn');
    if (terrainHorseSpawn) terrainHorseSpawn.value = DEFAULT_WORLD_OPTIONS.horseSpawnChance;
    
    const terrainChestSpawn = document.getElementById('terrain-chest-spawn');
    if (terrainChestSpawn) terrainChestSpawn.value = DEFAULT_WORLD_OPTIONS.chestSpawnChance;
    
    const mobDensity = document.getElementById('mob-density');
    if (mobDensity) mobDensity.value = DEFAULT_WORLD_OPTIONS.mobDensityMultiplier;
    
    const resourceDensity = document.getElementById('resource-density');
    if (resourceDensity) resourceDensity.value = DEFAULT_WORLD_OPTIONS.resourceDensityMultiplier;
    
    const caveDensity = document.getElementById('cave-density');
    if (caveDensity) caveDensity.value = DEFAULT_WORLD_OPTIONS.caveDensityMultiplier;
    
    const waterAmount = document.getElementById('water-amount');
    if (waterAmount) waterAmount.value = DEFAULT_WORLD_OPTIONS.waterAmountMultiplier;
    
    if (currentGameMode === GAME_MODE_SURVIVAL) {
      const hungerEnabled = document.getElementById('hunger-enabled');
      if (hungerEnabled) hungerEnabled.checked = DEFAULT_WORLD_OPTIONS.hungerEnabled;
      
      const sleepRequired = document.getElementById('sleep-required');
      if (sleepRequired) sleepRequired.checked = DEFAULT_WORLD_OPTIONS.sleepRequired;
      
      const hungerDecayRate = document.getElementById('hunger-decay-rate');
      if (hungerDecayRate) hungerDecayRate.value = DEFAULT_WORLD_OPTIONS.hungerDecayRate;
      
      const sleepDuration = document.getElementById('sleep-duration');
      if (sleepDuration) sleepDuration.value = DEFAULT_WORLD_OPTIONS.sleepDuration;
      
      const tiredDebuff = document.getElementById('tired-debuff');
      if (tiredDebuff) tiredDebuff.value = DEFAULT_WORLD_OPTIONS.tiredDebuff;
    }
    updateTerrainLabels();
  });

  terrainCancelBtn?.addEventListener('click', () => {
    gameStarted = false;
    currentGameMode = GAME_MODE_NORMAL;
    terrainModal?.close();
    if (mainMenu) {
      mainMenu.hidden = false;
      mainMenu.classList.add('visible');
    }
  });

  const updateTerrainLabels = () => {
    if (horseSpawnValue && horseSpawnInput) horseSpawnValue.textContent = `${Number(horseSpawnInput.value).toFixed(1)}x`;
    if (chestSpawnValue && chestSpawnInput) chestSpawnValue.textContent = `${Number(chestSpawnInput.value).toFixed(1)}x`;
    
    const terrainHorseSpawn = document.getElementById('terrain-horse-spawn');
    const terrainHorseSpawnValue = document.getElementById('terrain-horse-spawn-value');
    if (terrainHorseSpawn && terrainHorseSpawnValue) terrainHorseSpawnValue.textContent = `${Number(terrainHorseSpawn.value).toFixed(1)}x`;
    
    const terrainChestSpawn = document.getElementById('terrain-chest-spawn');
    const terrainChestSpawnValue = document.getElementById('terrain-chest-spawn-value');
    if (terrainChestSpawn && terrainChestSpawnValue) terrainChestSpawnValue.textContent = `${Number(terrainChestSpawn.value).toFixed(1)}x`;
    
    const mobDensity = document.getElementById('mob-density');
    const mobDensityValue = document.getElementById('mob-density-value');
    if (mobDensity && mobDensityValue) mobDensityValue.textContent = `${Number(mobDensity.value).toFixed(1)}x`;
    
    const resourceDensity = document.getElementById('resource-density');
    const resourceDensityValue = document.getElementById('resource-density-value');
    if (resourceDensity && resourceDensityValue) resourceDensityValue.textContent = `${Number(resourceDensity.value).toFixed(1)}x`;
    
    const caveDensity = document.getElementById('cave-density');
    const caveDensityValue = document.getElementById('cave-density-value');
    if (caveDensity && caveDensityValue) caveDensityValue.textContent = `${Number(caveDensity.value).toFixed(1)}x`;
    
    const waterAmount = document.getElementById('water-amount');
    const waterAmountValue = document.getElementById('water-amount-value');
    if (waterAmount && waterAmountValue) waterAmountValue.textContent = `${Number(waterAmount.value).toFixed(1)}x`;
    
    if (currentGameMode === GAME_MODE_SURVIVAL) {
      const hungerDecayRate = document.getElementById('hunger-decay-rate');
      const hungerDecayRateValue = document.getElementById('hunger-decay-rate-value');
      if (hungerDecayRate && hungerDecayRateValue) hungerDecayRateValue.textContent = `${Number(hungerDecayRate.value).toFixed(2)} HP/s`;
      
      const sleepDuration = document.getElementById('sleep-duration');
      const sleepDurationValue = document.getElementById('sleep-duration-value');
      if (sleepDuration && sleepDurationValue) sleepDurationValue.textContent = `${Number(sleepDuration.value).toFixed(0)}s`;
      
      const tiredDebuff = document.getElementById('tired-debuff');
      const tiredDebuffValue = document.getElementById('tired-debuff-value');
      if (tiredDebuff && tiredDebuffValue) tiredDebuffValue.textContent = `${Number(tiredDebuff.value).toFixed(0)}%`;
    }
  };

  // Add input listeners for terrain modal labels
  document.getElementById('mob-density')?.addEventListener('input', updateTerrainLabels);
  document.getElementById('resource-density')?.addEventListener('input', updateTerrainLabels);
  document.getElementById('cave-density')?.addEventListener('input', updateTerrainLabels);
  document.getElementById('water-amount')?.addEventListener('input', updateTerrainLabels);
  document.getElementById('terrain-horse-spawn')?.addEventListener('input', updateTerrainLabels);
  document.getElementById('terrain-chest-spawn')?.addEventListener('input', updateTerrainLabels);
  document.getElementById('hunger-enabled')?.addEventListener('input', updateTerrainLabels);
  document.getElementById('sleep-required')?.addEventListener('input', updateTerrainLabels);
  document.getElementById('hunger-decay-rate')?.addEventListener('input', updateTerrainLabels);
  document.getElementById('sleep-duration')?.addEventListener('input', updateTerrainLabels);
  document.getElementById('tired-debuff')?.addEventListener('input', updateTerrainLabels);

  // Fullscreen button for mobile - only show on touch devices when not fullscreen
  const fsBtn = document.getElementById('fullscreen-btn');
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let lastViewportSignature = `${window.innerWidth}x${window.innerHeight}`;

  function updateFullscreenBtn() {
    const isFullscreen = !!document.fullscreenElement;
    fsBtn.style.display = (isTouchDevice && !isFullscreen) ? 'block' : 'none';
  }

  if (isTouchDevice && document.documentElement.requestFullscreen) {
    fsBtn.addEventListener('click', () => {
      document.documentElement.requestFullscreen().catch(() => {});
    });
    document.addEventListener('fullscreenchange', updateFullscreenBtn);
    updateFullscreenBtn();
  }

  if (isTouchDevice) {
    const reloadForOrientationChange = () => {
      const nextViewportSignature = `${window.innerWidth}x${window.innerHeight}`;
      if (nextViewportSignature === lastViewportSignature) return;
      lastViewportSignature = nextViewportSignature;
      window.location.reload();
    };

    window.addEventListener('orientationchange', reloadForOrientationChange);
    window.screen?.orientation?.addEventListener?.('change', reloadForOrientationChange);
  }
}
