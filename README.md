# SoloHiem

SoloHiem is a single-player conversion of
[DarkHiem](https://github.com/3disturbed/DarkHiem).

The game loads directly at `/` with no registration, login, character picker,
session API, or multiplayer server. The original authoritative simulation now
runs in the browser through an in-process transport. Player, world, and land
data are saved in browser storage under a fixed `solo-player` identity.

The repository is directly compatible with GitHub Pages, including project
paths such as `/SoloHiem/`.

## Run

Requires Node.js 18 or newer.

```sh
npm install
npm start
```

Open `http://localhost:3000` when using:

```sh
PORT=3000 npm start
```

The Node host is optional and remains useful for local development. GitHub
Pages can serve `index.html` directly; no WebSocket or server process is
required. World generation, combat, crafting, NPCs, quests, and persistence all
run locally in the browser.
