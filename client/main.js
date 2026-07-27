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
const GAME_MODE_NORMAL = 'normal';
const GAME_MODE_SURVIVAL = 'survival';

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
  const helpDialog = document.getElementById('help-dialog');
  const saveDialog = document.getElementById('save-dialog');
  let loaderReady = false;
  let brandFinished = !brandSplash;
  let brandHandoffDone = !brandSplash;
  let gameStarted = false;
  let menuShown = false;

  const launchGame = (mode = GAME_MODE_NORMAL) => {
    if (gameStarted) return;
    gameStarted = true;
    window.__DWARVEN_TAMERS_MODE = mode;
    localStorage.setItem(GAME_MODE_KEY, mode);
    mainMenu?.classList.remove('visible');
    if (mainMenu) mainMenu.hidden = true;
    const game = new Game(canvas);
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
  helpButton?.addEventListener('click', () => helpDialog?.showModal());
  saveButton?.addEventListener('click', () => saveDialog?.showModal());

  // Fullscreen button for mobile - only show on touch devices when not fullscreen
  const fsBtn = document.getElementById('fullscreen-btn');
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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
}
