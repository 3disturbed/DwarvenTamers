import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { appendFileSync } from 'fs';
import SocketManager from './network/SocketManager.js';
import GameServer from './GameServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket'],
});

// Serve the game as a directly loadable static page.
app.use('/client', express.static(join(ROOT, 'client')));
app.use('/shared', express.static(join(ROOT, 'shared')));
app.use('/data', express.static(join(ROOT, 'data')));
app.use('/tileArt', express.static(join(ROOT, 'tileArt')));

app.get('/', (req, res) => {
  res.sendFile(join(ROOT, 'index.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(join(ROOT, 'index.html'));
});

// Initialize game
const gameServer = new GameServer(io);
const socketManager = new SocketManager(io, gameServer);

const PORT = process.env.PORT || 80;

async function boot() {
  await gameServer.init();

  httpServer.listen(PORT, () => {
    console.log(`[SoloHiem] Single-player game running on http://localhost:${PORT}`);
    gameServer.start();
  });
}

const CRASH_LOG = join(ROOT, 'crash.log');

process.on('uncaughtException', (err) => {
  const msg = `[${new Date().toISOString()}] UNCAUGHT: ${err.stack || err}\n`;
  console.error(msg);
  appendFileSync(CRASH_LOG, msg);
});

process.on('unhandledRejection', (err) => {
  const msg = `[${new Date().toISOString()}] REJECTION: ${err?.stack || err}\n`;
  console.error(msg);
  appendFileSync(CRASH_LOG, msg);
});

boot().catch((err) => {
  console.error('[NordFolk] Failed to start:', err);
  process.exit(1);
});
