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
import { initializePwa } from './pwa.js';
import { initializeOnboarding } from './onboarding.js';
import { initializeSaveManager } from './save-manager.js';

// DwarvenTamers has one local character and loads directly without an account screen.
initializePwa();
initializeOnboarding();
initializeSaveManager();
startGame();

const BRAND_SPLASH_MS = 1850;

function startGame() {
  const canvas = document.getElementById('game');
  const brandSplash = document.getElementById('brand-splash');
  const splashBar = document.getElementById('splash-bar');
  const splashText = document.getElementById('splash-text');
  const splash = document.getElementById('splash');
  let loaderReady = false;
  let brandFinished = !brandSplash;
  let gameStarted = false;

  const maybeStartGame = () => {
    if (gameStarted || !loaderReady || !brandFinished) return;
    gameStarted = true;
    if (splashText) splashText.textContent = 'Starting...';
    const game = new Game(canvas);
    game.start();
    if (splash) {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 700);
    }
  };

  if (splash) {
    splash.classList.add('pre-splash-hidden');
  }

  if (brandSplash) {
    setTimeout(() => {
      brandSplash.classList.add('fade-out');
      splash?.classList.remove('pre-splash-hidden');
      setTimeout(() => brandSplash.remove(), 750);
      brandFinished = true;
      maybeStartGame();
    }, BRAND_SPLASH_MS);
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
    maybeStartGame();
  });

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
