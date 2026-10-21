const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { attachGameNavigation } = require('../src/lib/game-navigation');

class FakeContents extends EventEmitter {
  setWindowOpenHandler(handler) { this.openWindow = handler; }
  navigation(eventName, url) {
    let blocked = false;
    this.emit(eventName, { preventDefault: () => { blocked = true; } }, url);
    return blocked;
  }
}

function setup(restrictNavigation = true) {
  const game = { url: 'https://jogo.drakoriaidle.com.br/play', restrictNavigation };
  const blocked = [];
  const contents = new FakeContents();
  attachGameNavigation(contents, { getGame: () => game, onBlocked: (url) => blocked.push(url) });
  return { game, blocked, contents };
}

test('jogo restrito permite a origem exata e bloqueia outros hosts, portas e protocolos', () => {
  const { contents, blocked } = setup();
  const allowed = 'https://jogo.drakoriaidle.com.br/hunts?mode=1';
  assert.equal(contents.openWindow({ url: allowed }).action, 'allow');
  assert.equal(contents.navigation('will-navigate', allowed), false);
  assert.equal(contents.navigation('will-redirect', allowed), false);

  const denied = [
    'https://jogo.drakoriaidle.com.br.attacker.example/',
    'https://jogo.drakoriaidle.com.br:8443/',
    'http://jogo.drakoriaidle.com.br/',
    'https://other.example/',
    'javascript:alert(1)',
    'file:///C:/Windows/win.ini',
    'not a valid URL'
  ];
  for (const url of denied) {
    assert.equal(contents.openWindow({ url }).action, 'deny', url);
    assert.equal(contents.navigation('will-navigate', url), true, url);
    assert.equal(contents.navigation('will-redirect', url), true, url);
  }
  assert.equal(blocked.length, denied.length * 3);
});

test('popup em branco mantém a restrição ao navegar e abrir descendentes', () => {
  const { contents, blocked } = setup();
  assert.equal(contents.openWindow({ url: 'about:blank' }).action, 'allow');
  const child = new FakeContents();
  contents.emit('did-create-window', { webContents: child });
  const outside = 'https://outside.example/';
  const inside = 'https://jogo.drakoriaidle.com.br/preset';
  assert.equal(child.navigation('will-navigate', outside), true);
  assert.equal(child.navigation('will-redirect', outside), true);
  assert.equal(child.navigation('will-navigate', inside), false);
  assert.equal(child.openWindow({ url: outside }).action, 'deny');
  assert.equal(child.openWindow({ url: 'about:blank' }).action, 'allow');
  const grandchild = new FakeContents();
  child.emit('did-create-window', { webContents: grandchild });
  assert.equal(grandchild.navigation('will-navigate', outside), true);
  assert.equal(grandchild.navigation('will-redirect', outside), true);
  assert.equal(grandchild.openWindow({ url: outside }).action, 'deny');
  assert.equal(grandchild.openWindow({ url: inside }).action, 'allow');
  assert.deepEqual(blocked, Array(6).fill(outside));
});

test('jogo sem restrição mantém popups HTTP, HTTPS e em branco', () => {
  const { contents, blocked } = setup(false);
  for (const url of ['http://other.example/', 'https://other.example/', 'about:blank']) {
    assert.equal(contents.openWindow({ url }).action, 'allow', url);
  }
  assert.equal(contents.navigation('will-navigate', 'https://other.example/'), false);
  const child = new FakeContents();
  contents.emit('did-create-window', { webContents: child });
  assert.equal(child.navigation('will-redirect', 'https://other.example/'), false);
  assert.equal(child.openWindow({ url: 'https://other.example/' }).action, 'allow');
  assert.deepEqual(blocked, []);
  for (const url of ['file:///C:/Windows/win.ini', 'javascript:alert(1)', 'not a valid URL']) {
    assert.equal(contents.openWindow({ url }).action, 'deny', url);
  }
});

test('alterações da restrição são respeitadas também por janelas já abertas', () => {
  const { contents, game } = setup(false);
  const child = new FakeContents();
  contents.emit('did-create-window', { webContents: child });
  const outside = 'https://other.example/';
  assert.equal(child.openWindow({ url: outside }).action, 'allow');
  game.restrictNavigation = true;
  assert.equal(child.openWindow({ url: outside }).action, 'deny');
  assert.equal(child.navigation('will-navigate', outside), true);
  game.url = outside;
  assert.equal(child.navigation('will-navigate', outside), false);
});
