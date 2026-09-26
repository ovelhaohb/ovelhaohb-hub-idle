const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('package aponta para uma entrada existente', () => {
  const packageJson = JSON.parse(read('package.json'));
  const packageLock = JSON.parse(read('package-lock.json'));
  assert.ok(fs.existsSync(path.join(root, packageJson.main)));
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[''].version, packageJson.version);
});

test('janela principal mantém isolamento e sandbox', () => {
  const main = read('src/main.js');
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /assertHubSender\(event\)/);
});

test('F5 recarrega sem cache com foco no hub ou no jogo', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /input\.key === 'F5'/);
  assert.match(main, /contents\.reloadIgnoringCache\(\)/);
  assert.match(renderer, /event\.key === 'F5'/);
  assert.match(renderer, /view\.reloadIgnoringCache\(\)/);
});

test('proteção de navegação e modo econômico estão conectados', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /contents\.on\('will-navigate', protectNavigation\)/);
  assert.match(main, /contents\.on\('will-redirect', protectNavigation\)/);
  assert.match(renderer, /state\.settings\.memorySaverEnabled/);
  assert.match(renderer, /inactiveView\.remove\(\)/);
});

test('categorias, estados e dupla salva estão disponíveis', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/app.js');
  assert.match(main, /category: String\(input\.category/);
  assert.match(renderer, /function renderCategoryFilter\(\)/);
  assert.match(renderer, /function setGameStatus\(gameId, status\)/);
  assert.match(renderer, /split-partner:/);
});

test('histórico e retorno manual para versões anteriores estão expostos', () => {
  const main = read('src/main.js');
  const preload = read('src/preload.js');
  assert.match(main, /function recordUpdateStatus\(status\)/);
  assert.match(main, /updates:open-releases/);
  assert.match(preload, /getUpdateHistory/);
  assert.match(preload, /openPreviousVersions/);
});

test('webviews negam permissões por padrão', () => {
  const main = read('src/main.js');
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /callback\(false\)/);
});
