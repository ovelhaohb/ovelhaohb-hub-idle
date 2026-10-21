function canOpenGamePopup(game, url) {
  if (url === 'about:blank') return true;
  try {
    const target = new URL(url);
    if (!['http:', 'https:'].includes(target.protocol)) return false;
    return !game?.restrictNavigation || target.origin === new URL(game.url).origin;
  } catch {
    return false;
  }
}

function attachGameNavigation(contents, options) {
  const { getGame, onBlocked } = options;
  const protectNavigation = (event, url) => {
    const game = getGame();
    if (!game?.restrictNavigation) return;
    try {
      if (new URL(url).origin === new URL(game.url).origin) return;
    } catch {}
    event.preventDefault();
    onBlocked(url);
  };
  contents.on('will-navigate', protectNavigation);
  contents.on('will-redirect', protectNavigation);
  contents.setWindowOpenHandler(({ url }) => {
    if (canOpenGamePopup(getGame(), url)) return { action: 'allow' };
    onBlocked(url);
    return { action: 'deny' };
  });
  // Every new window keeps the policy of its game, including blank windows
  // whose URL is only assigned later and popups opened by another popup.
  contents.on('did-create-window', (window) => attachGameNavigation(window.webContents, options));
}

module.exports = { attachGameNavigation };
