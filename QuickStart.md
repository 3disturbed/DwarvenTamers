# SoloHiem quick start

## Play online

Open [SoloHiem on GitHub Pages](https://3disturbed.github.io/SoloHiem/).
Progress is saved privately in the browser. Use the disk button in the game to
download a portable backup.

After the first successful load, SoloHiem can be installed from the browser and
played offline.

## Run locally

Requires Node.js 18 or newer.

```sh
npm ci
npm start
```

Open <http://localhost:3000>. Set a different port when needed:

```sh
PORT=8080 npm start
```

The local process only serves static files. The single-player simulation and
saves run in the browser, exactly as they do on GitHub Pages.

## Verify a checkout

```sh
npm test
npm audit
```

The test suite validates persistence, save backup/recovery, the static/PWA
shell, and every referenced art asset.
