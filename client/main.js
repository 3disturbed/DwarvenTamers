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
};
const PERFORMANCE_PRESET_KEY = `${APP_STORAGE_PREFIX}performance-preset`; 
const PERFORMANCE_PRESETS = {
  power_saver: {
    id: 'power_saver',
    label: 'Power Saver',
    frameRateCap: 30,
    renderDetail: 'low',
    use3d: false,
    maxPixelRatio: 1,
    notes: 'Lowest load. Uses the 2D renderer and a 30 FPS cap.',
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
        <dt>Renderer</dt><dd>${preset.use3d ? '3D' : '2D'}</dd>
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
    };

    if (!Number.isFinite(options.horseSpawnChance)) options.horseSpawnChance = DEFAULT_WORLD_OPTIONS.horseSpawnChance;
    if (!Number.isFinite(options.chestSpawnChance)) options.chestSpawnChance = DEFAULT_WORLD_OPTIONS.chestSpawnChance;

    localStorage.setItem(WORLD_OPTIONS_KEY, JSON.stringify({
      seed: String(options.seed),
      horseSpawnChance: options.horseSpawnChance,
      chestSpawnChance: options.chestSpawnChance,
    }));

    return {
      ...options,
      performance: PERFORMANCE_PRESETS[performancePresetId] || PERFORMANCE_PRESETS[DEFAULT_PERFORMANCE_PRESET],
    };
  };

  const launchGame = (mode = GAME_MODE_NORMAL) => {
    if (gameStarted) return;
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
