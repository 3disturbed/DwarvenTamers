# SoloHiem

SoloHiem is a single-player conversion of
[DarkHiem](https://github.com/3disturbed/DarkHiem).

The game loads directly at `/` with no registration, login, character picker,
or session API. A fixed local player identity is used for the save in
`saves/players/solo-player.json`. Opening a second game tab replaces the first
connection, so only one player exists at a time.

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

The static client assets are served by the small Node host. The existing
authoritative game simulation remains local to that process, preserving world
generation, combat, crafting, NPCs, quests, and save persistence.
