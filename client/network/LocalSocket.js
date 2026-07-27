import GameServer from '../../server/GameServer.js';
import PlayerConnection from '../../server/network/PlayerConnection.js';

class LocalClientSocket {
  constructor(host) {
    this.host = host;
    this.listeners = new Map();
    this.connected = false;
    this.serverSocket = null;
    queueMicrotask(() => host.connect(this));
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
    return this;
  }

  emit(event, data) {
    if (this.connected && this.serverSocket?.player) {
      this.host.game.messageRouter.route(event, this.serverSocket.player, data);
    }
    return this;
  }

  receive(event, data) {
    for (const handler of this.listeners.get(event) || []) handler(data);
  }

  disconnect() {
    if (!this.connected) return;
    this.connected = false;
    this.host.disconnect(this.serverSocket);
    this.receive('disconnect');
  }
}

class LocalServerSocket {
  constructor(client) {
    this.client = client;
    this.id = 'local-socket';
    this.connected = true;
    this.player = null;
    this.broadcast = { emit() {} };
  }

  emit(event, data) {
    if (this.connected) this.client.receive(event, data);
  }

  disconnect() {
    this.client.disconnect();
  }
}

class LocalIo {
  constructor() {
    this.sockets = { sockets: new Map() };
  }

  emit(event, data) {
    for (const socket of this.sockets.sockets.values()) socket.emit(event, data);
  }

  except(socketId) {
    return {
      emit: (event, data) => {
        for (const [id, socket] of this.sockets.sockets) {
          if (id !== socketId) socket.emit(event, data);
        }
      },
    };
  }
}

class LocalGameHost {
  constructor() {
    this.io = new LocalIo();
    this.game = new GameServer(this.io);
    this.ready = this.game.init().then(() => this.game.start());
  }

  async connect(client) {
    try {
      await this.ready;
      const socket = new LocalServerSocket(client);
      const player = new PlayerConnection(socket, 'solo-player', 'Adventurer', '#c9a84c');
      socket.player = player;
      client.serverSocket = socket;
      client.connected = true;
      this.io.sockets.sockets.set(socket.id, socket);
      client.receive('connect');
      await this.game.onPlayerJoin(player);
    } catch (error) {
      console.error('[SoloHiem] Failed to start local game:', error);
      client.receive('connect_error', error);
    }
  }

  async disconnect(socket) {
    if (!socket) return;
    socket.connected = false;
    this.io.sockets.sockets.delete(socket.id);
    if (socket.player) {
      socket.player.connected = false;
      await this.game.onPlayerLeave(socket.player);
    }
  }
}

let host;

export function createLocalSocket() {
  if (!host) host = new LocalGameHost();
  return new LocalClientSocket(host);
}
