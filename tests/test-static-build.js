import { access, readFile } from 'node:fs/promises';

let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  [PASS] ${message}`);
  passed++;
}

console.log('\nSoloHiem Static Build Tests');

const html = await readFile(new URL('../index.html', import.meta.url), 'utf-8');
const manifest = JSON.parse(
  await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf-8'),
);
const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf-8');

assert(html.includes('rel="manifest" href="./manifest.webmanifest"'), 'manifest uses a project-relative URL');
assert(html.includes('src="./client/main.js"'), 'game entry point uses a project-relative URL');
assert(!html.includes('/socket.io/'), 'static page has no Socket.IO dependency');
assert(manifest.start_url === './' && manifest.scope === './', 'manifest stays inside the Pages project scope');
assert(manifest.display === 'fullscreen', 'installed game launches fullscreen');
assert(worker.includes("'./index.html'"), 'service worker precaches the offline entry point');
assert(worker.includes("url.hostname === 'cdn.jsdelivr.net'"), 'service worker caches the noise module dependency');
assert(html.includes('id="help-dialog"'), 'first-run guide is present');
assert(worker.includes("'./client/onboarding.js'"), 'first-run guide works offline');
assert(html.includes('id="save-dialog"'), 'save data center is present');
assert(worker.includes("'./client/save-manager.js'"), 'save data center works offline');

for (const path of [
  '../index.html',
  '../manifest.webmanifest',
  '../icon.svg',
  '../sw.js',
  '../client/main.js',
  '../client/pwa.js',
  '../client/onboarding.js',
  '../client/save-manager.js',
  '../.nojekyll',
]) {
  await access(new URL(path, import.meta.url));
}
assert(true, 'all PWA shell files exist');

console.log(`\n  Results: ${passed} passed, 0 failed`);
