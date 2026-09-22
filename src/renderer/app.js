const $ = (selector) => document.querySelector(selector);
const colors = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef476f'];

const state = { games: [], activeId: null, splitId: null, selectedColor: colors[0], passwordVisible: false, recovery: new Map(), search: '', reminders: [], companion: { tasks: [], links: [] } };
const els = {
  list: $('#gameList'), count: $('#gameCount'), welcome: $('#welcome'), toolbar: $('#toolbar'),
  stack: $('#webviewStack'), address: $('#addressText'), dialog: $('#gameDialog'), form: $('#gameForm'),
  popover: $('#loginPopover'), loading: $('#loadingBar'), toast: $('#toast'), reminderDialog: $('#reminderDialog')
};

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function safeIconUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function iconSource(game) {
  if (domain(game.url) === 'jogo.drakoriaidle.com.br') return 'assets/drakoria-favicon.png';
  return safeIconUrl(game.icon);
}

function activeGame() { return state.games.find((game) => game.id === state.activeId); }

function renderList() {
  els.count.textContent = state.games.length;
  const search = state.search.trim().toLocaleLowerCase('pt-BR');
  const games = [...state.games]
    .filter((game) => !search || `${game.name} ${domain(game.url)}`.toLocaleLowerCase('pt-BR').includes(search))
    .sort((first, second) => Number(second.favorite) - Number(first.favorite) || first.name.localeCompare(second.name, 'pt-BR'));
  els.list.replaceChildren(...games.map((game) => {
    const item = document.createElement('button');
    item.className = `game-item${game.id === state.activeId ? ' active' : ''}`;
    item.dataset.id = game.id;
    item.innerHTML = `<span class="active-line"></span><span class="game-avatar" style="background:linear-gradient(135deg,${game.color},${game.color}88)"></span><span class="game-meta"><strong></strong><small></small></span>`;
    const avatar = item.querySelector('.game-avatar');
    const icon = iconSource(game);
    if (icon) {
      const image = document.createElement('img');
      image.src = icon;
      image.alt = '';
      image.addEventListener('error', () => { avatar.textContent = initials(game.name); });
      avatar.appendChild(image);
    } else {
      avatar.textContent = initials(game.name);
    }
    const name = item.querySelector('strong');
    name.dataset.favorite = game.favorite ? '★' : '';
    name.textContent = game.name;
    item.querySelector('small').textContent = domain(game.url);
    item.addEventListener('click', () => openGame(game.id));
    return item;
  }));
}

function setLoading(loading) {
  els.loading.className = `loading-bar ${loading ? 'loading' : 'done'}`;
  if (!loading) setTimeout(() => els.loading.className = 'loading-bar', 300);
}

function updateMuteButton() {
  const game = activeGame();
  const button = $('#mute');
  if (!button || !game) return;
  button.textContent = game.muted ? '🔇' : '🔊';
  button.setAttribute('aria-label', game.muted ? 'Ativar som da aba' : 'Silenciar aba');
  button.title = game.muted ? 'Ativar som da aba' : 'Silenciar aba';
}

function updateFavoriteButton() {
  const game = activeGame();
  const button = $('#favorite');
  if (!button || !game) return;
  button.textContent = game.favorite ? '★' : '☆';
  button.setAttribute('aria-label', game.favorite ? 'Remover dos favoritos' : 'Favoritar jogo');
  button.title = game.favorite ? 'Remover dos favoritos' : 'Favoritar jogo';
}

function updateZoomControls() {
  const game = activeGame();
  const button = $('#zoomReset');
  if (button) button.textContent = `${Math.round((game?.zoomFactor || 1) * 100)}%`;
}

async function changeZoom(delta = 0, reset = false) {
  const game = activeGame();
  const view = currentView();
  if (!game || !view) return;
  const zoomFactor = reset ? 1 : Math.max(0.5, Math.min(2, Math.round(((game.zoomFactor || 1) + delta) * 100) / 100));
  try {
    view.setZoomFactor(zoomFactor);
    await saveGameChanges(game, { zoomFactor });
    updateZoomControls();
    showToast(`Zoom: ${Math.round(zoomFactor * 100)}%`);
  } catch { showToast('Não foi possível alterar o zoom'); }
}

async function saveGameChanges(game, changes) {
  const saved = await window.drakoria.saveGame({ ...game, ...changes });
  const index = state.games.findIndex((entry) => entry.id === saved.id);
  if (index >= 0) state.games[index] = saved;
  return saved;
}

function currentGame(id) {
  return state.games.find((game) => game.id === id);
}

function sameOrigin(first, second) {
  try { return new URL(first).origin === new URL(second).origin; } catch { return false; }
}

async function fillGameCredentials(game, view = currentView()) {
  if (!game || !view || !game.hasCredentials) return false;
  const url = view.getURL();
  if (!sameOrigin(url, game.url)) return false;
  let credentials;
  try { credentials = await window.drakoria.getCredentials(game.id); } catch { return false; }
  const payload = JSON.stringify(credentials);
  try {
    const filled = await view.executeJavaScript(`(() => {
      const saved = ${payload};
      const fields = [...document.querySelectorAll('input:not([type="hidden"]):not([disabled])')];
      const password = fields.find((field) => field.type === 'password');
      const user = fields.find((field) => field.autocomplete === 'username') ||
        fields.find((field) => /user|login|email|conta/i.test([field.name, field.id, field.autocomplete, field.type].join(' '))) ||
        fields.find((field) => field.type === 'email' || field.type === 'text');
      const setValue = (field, value) => {
        if (!field || !value) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      const changedUser = setValue(user, saved.username);
      const changedPassword = setValue(password, saved.password);
      return changedUser || changedPassword;
    })()`);
    return Boolean(filled);
  } catch {
    return false;
  }
}

function createWebview(game) {
  let view = document.querySelector(`[data-view-id="${game.id}"]`);
  if (view) return view;
  view = document.createElement('webview');
  view.className = 'game-view';
  view.tabIndex = 0;
  view.dataset.viewId = game.id;
  view.setAttribute('partition', `persist:game-${game.id}`);
  view.setAttribute('webpreferences', 'backgroundThrottling=no, spellcheck=no');
  view.addEventListener('dom-ready', () => {
    const latestGame = currentGame(game.id);
    try { view.setAudioMuted(Boolean(latestGame?.muted)); } catch {}
    try { view.setBackgroundThrottling(latestGame?.keepActive === false); } catch {}
    try { view.setZoomFactor(latestGame?.zoomFactor || 1); } catch {}
    view.executeJavaScript(`(() => {
      const icon = document.querySelector('link[rel~="icon"]')?.href;
      return icon || new URL('/favicon.ico', location.origin).href;
    })()`).then(async (icon) => {
      const iconUrl = safeIconUrl(icon);
      const latest = currentGame(game.id);
      if (!latest || !iconUrl || iconUrl === latest.icon) return;
      try {
        await saveGameChanges(latest, { icon: iconUrl });
        renderList();
      } catch {}
    }).catch(() => {});
  });
  view.src = game.url;
  view.addEventListener('did-start-loading', () => { if (state.activeId === game.id) setLoading(true); });
  view.addEventListener('did-stop-loading', async () => {
    if (state.activeId !== game.id) return;
    setLoading(false);
    updateAddress(view);
    const loadedUrl = view.getURL();
    const latestGame = currentGame(game.id);
    if (latestGame?.autoFill && view.dataset.autofilledUrl !== loadedUrl) {
      if (await fillGameCredentials(latestGame, view)) {
        view.dataset.autofilledUrl = loadedUrl;
        showToast('Credenciais preenchidas');
      }
    }
  });
  view.addEventListener('did-navigate', () => { if (state.activeId === game.id) updateAddress(view); });
  view.addEventListener('did-navigate-in-page', () => { if (state.activeId === game.id) updateAddress(view); });
  view.addEventListener('dom-ready', () => {
    if (state.activeId === game.id && !els.dialog.open) view.focus();
  });
  view.addEventListener('page-title-updated', (event) => { if (state.activeId === game.id) document.title = `${event.title} — OvelhaoHb Idles Hub`; });
  view.addEventListener('render-process-gone', (event) => {
    if (['clean-exit', 'killed'].includes(event.details?.reason)) return;
    const previous = state.recovery.get(game.id) || { attempts: 0, since: Date.now() };
    const recent = Date.now() - previous.since < 5 * 60 * 1000;
    const recovery = recent ? { ...previous, attempts: previous.attempts + 1 } : { attempts: 1, since: Date.now() };
    state.recovery.set(game.id, recovery);
    if (recovery.attempts > 3) {
      if (state.activeId === game.id) showToast('O jogo parou repetidamente. Use recarregar.');
      return;
    }
    if (state.activeId === game.id) showToast('Recuperando o jogo automaticamente…');
    setTimeout(() => {
      if (!view.isConnected) return;
      try { view.reload(); } catch {}
    }, 1200);
  });
  els.stack.appendChild(view);
  return view;
}

function updateAddress(view) {
  try { els.address.textContent = view.getURL() || activeGame()?.url || ''; } catch { els.address.textContent = activeGame()?.url || ''; }
}

function openGame(id) {
  const game = state.games.find((entry) => entry.id === id);
  if (!game) return;
  state.activeId = id;
  setSidebarCollapsed(true);
  els.welcome.classList.add('hidden');
  els.toolbar.classList.remove('hidden');
  els.stack.style.display = 'block';
  document.querySelectorAll('.game-view').forEach((view) => view.classList.remove('active', 'split-primary'));
  const view = createWebview(game);
  view.classList.add('active', 'split-primary');
  if (state.splitId) {
    const secondary = createWebview(state.games.find((entry) => entry.id === state.splitId));
    secondary.classList.add('active', 'split-secondary');
    els.stack.classList.add('split');
  }
  requestAnimationFrame(() => view.focus());
  updateAddress(view);
  updateMuteButton();
  updateFavoriteButton();
  updateZoomControls();
  els.popover.classList.add('hidden');
  renderList();
}

function currentView() { return document.querySelector('.game-view.active.split-primary') || document.querySelector('.game-view.active'); }

async function openDialog(game = null, credentialsOnly = false) {
  currentView()?.blur();
  els.form.reset();
  $('#formError').textContent = '';
  els.form.classList.toggle('credentials-only', credentialsOnly);
  $('#dialogTitle').textContent = credentialsOnly ? 'Atualizar login' : (game ? 'Editar jogo' : 'Adicionar jogo');
  $('#gameId').value = game?.id || '';
  $('#gameName').value = game?.name || '';
  $('#gameUrl').value = game?.url || '';
  let credentials = { username: '', password: '' };
  if (game?.hasCredentials) {
    try { credentials = await window.drakoria.getCredentials(game.id); } catch {}
  }
  $('#gameUsername').value = credentials.username || '';
  $('#gamePassword').value = credentials.password || '';
  $('#gameAutoFill').checked = Boolean(game?.autoFill);
  $('#gameKeepActive').checked = game?.keepActive !== false;
  state.selectedColor = game?.color || colors[0];
  renderColors();
  els.popover.classList.add('hidden');
  els.dialog.showModal();
  setTimeout(() => $('#gameName').focus(), 50);
}

function renderColors() {
  $('#colorOptions').replaceChildren(...colors.map((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `color-option${color === state.selectedColor ? ' selected' : ''}`;
    button.style.background = color;
    button.setAttribute('aria-label', `Cor ${color}`);
    button.addEventListener('click', () => { state.selectedColor = color; renderColors(); });
    return button;
  }));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 1900);
}

function showUpdateStatus(status) {
  const banner = $('#updateBanner');
  const message = $('#updateMessage');
  const action = $('#updateAction');
  if (!status || ['current', 'development'].includes(status.state)) return banner.classList.add('hidden');
  if (status.state === 'checking') { message.textContent = 'Verificando atualizações…'; action.classList.add('hidden'); }
  if (status.state === 'available') { message.textContent = `Versão ${status.version} disponível`; action.textContent = 'Baixar'; action.classList.remove('hidden'); action.onclick = () => window.drakoria.downloadUpdate(); }
  if (status.state === 'downloading') { message.textContent = `Baixando atualização: ${status.percent || 0}%`; action.classList.add('hidden'); }
  if (status.state === 'ready') { message.textContent = `Versão ${status.version} pronta`; action.textContent = 'Instalar e reiniciar'; action.classList.remove('hidden'); action.onclick = () => window.drakoria.installUpdate(); }
  if (status.state === 'error') { message.textContent = 'Não foi possível verificar atualizações'; action.textContent = 'Tentar novamente'; action.classList.remove('hidden'); action.onclick = () => window.drakoria.checkForUpdates(); }
  banner.classList.remove('hidden');
}

async function openNotes() {
  const game = activeGame();
  if (!game) return;
  $('#notesGameName').textContent = game.name;
  $('#notesError').textContent = '';
  try {
    const [note, companion] = await Promise.all([window.drakoria.getNote(game.id), window.drakoria.getCompanion(game.id)]);
    $('#gameNotes').value = note;
    state.companion = companion;
    renderCompanion();
    $('#notesDialog').showModal();
    setTimeout(() => $('#gameNotes').focus(), 50);
  } catch {
    showToast('Não foi possível carregar as notas');
  }
}

function renderCompanion() {
  const tasks = $('#taskList'); const links = $('#linkList');
  tasks.replaceChildren(...state.companion.tasks.map((task, index) => { const row = document.createElement('div'); row.className = 'companion-row'; const check = document.createElement('input'); check.type = 'checkbox'; check.checked = task.done; check.addEventListener('change', () => { task.done = check.checked; }); const text = document.createElement('span'); text.textContent = task.text; const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.onclick = () => { state.companion.tasks.splice(index, 1); renderCompanion(); }; row.append(check, text, remove); return row; }));
  links.replaceChildren(...state.companion.links.map((link, index) => { const row = document.createElement('div'); row.className = 'companion-row'; const anchor = document.createElement('a'); anchor.href = link.url; anchor.textContent = link.label; anchor.target = '_blank'; const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.onclick = () => { state.companion.links.splice(index, 1); renderCompanion(); }; row.append(anchor, remove); return row; }));
}

function formatMemory(kilobytes) {
  if (!Number.isFinite(kilobytes)) return 'Indisponível';
  return kilobytes >= 1024 ? `${(kilobytes / 1024).toFixed(1)} MB` : `${Math.round(kilobytes)} KB`;
}

async function renderDiagnostics() {
  const list = $('#diagnosticsList');
  list.replaceChildren(Object.assign(document.createElement('p'), { className: 'reminder-empty', textContent: 'Atualizando…' }));
  try {
    const diagnostics = await window.drakoria.getDiagnostics();
    if (!diagnostics.length) {
      list.replaceChildren(Object.assign(document.createElement('p'), { className: 'reminder-empty', textContent: 'Nenhum jogo foi carregado nesta sessão.' }));
      return;
    }
    list.replaceChildren(...diagnostics.map((entry) => {
      const game = state.games.find((item) => item.id === entry.id);
      const item = document.createElement('div');
      item.className = 'diagnostics-item';
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = game?.name || 'Jogo removido';
      const details = document.createElement('small');
      details.textContent = entry.processId ? `Processo ${entry.processId}` : 'Processo indisponível';
      content.append(title, details);
      const memory = document.createElement('span');
      memory.className = 'diagnostics-memory';
      memory.textContent = formatMemory(entry.memory);
      item.append(content, memory);
      return item;
    }));
  } catch { list.replaceChildren(Object.assign(document.createElement('p'), { className: 'reminder-empty', textContent: 'Não foi possível obter o diagnóstico.' })); }
}

function formatReminderTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'em breve';
}

function renderReminders() {
  const list = $('#reminderList');
  const reminders = [...state.reminders].sort((first, second) => first.nextAt - second.nextAt);
  if (!reminders.length) {
    list.replaceChildren(Object.assign(document.createElement('p'), { className: 'reminder-empty', textContent: 'Nenhum lembrete criado.' }));
    return;
  }
  list.replaceChildren(...reminders.map((reminder) => {
    const item = document.createElement('div');
    item.className = 'reminder-item';
    const content = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = reminder.title;
    const details = document.createElement('small');
    details.textContent = `A cada ${reminder.intervalMinutes} min · Próximo: ${formatReminderTime(reminder.nextAt)}`;
    content.append(title, details);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remover';
    remove.addEventListener('click', async () => {
      await window.drakoria.deleteReminder(reminder.id);
      state.reminders = state.reminders.filter((entry) => entry.id !== reminder.id);
      renderReminders();
      showToast('Lembrete removido');
    });
    item.append(content, remove);
    return item;
  }));
}

async function refreshReminders() {
  state.reminders = await window.drakoria.listReminders();
  renderReminders();
}

async function showCredentials() {
  const game = activeGame();
  if (!game) return;
  let credentials = { username: '', password: '' };
  if (game.hasCredentials) {
    try { credentials = await window.drakoria.getCredentials(game.id); } catch { return showToast('Não foi possível acessar as credenciais'); }
  }
  $('#loginGame').textContent = game.name;
  $('#loginUsername').textContent = credentials.username || 'Não informado';
  $('#loginPassword').textContent = credentials.password ? '••••••••••' : 'Não informada';
  els.popover.dataset.password = credentials.password || '';
  state.passwordVisible = false;
  els.popover.classList.toggle('hidden');
}

$('#addGame').addEventListener('click', () => openDialog());
$('#welcomeAdd').addEventListener('click', () => openDialog());
$('#reminders').addEventListener('click', async () => {
  await refreshReminders();
  $('#reminderError').textContent = '';
  els.reminderDialog.showModal();
  setTimeout(() => $('#reminderTitle').focus(), 50);
});
$('#closeReminders').addEventListener('click', () => { els.reminderDialog.close(); currentView()?.focus(); });
$('#dismissUpdate').addEventListener('click', () => $('#updateBanner').classList.add('hidden'));
$('#notes').addEventListener('click', openNotes);
$('#addTask').addEventListener('click', () => { const text = $('#taskText').value.trim(); if (!text) return; state.companion.tasks.push({ text, done: false }); $('#taskText').value = ''; renderCompanion(); });
$('#addLink').addEventListener('click', () => { const label = $('#linkLabel').value.trim(); const url = $('#linkUrl').value.trim(); if (!label || !url) return showToast('Informe nome e endereço do link'); state.companion.links.push({ label, url }); $('#linkLabel').value = ''; $('#linkUrl').value = ''; renderCompanion(); });
$('#diagnostics').addEventListener('click', async () => { $('#diagnosticsDialog').showModal(); await renderDiagnostics(); });
$('#closeDiagnostics').addEventListener('click', () => { $('#diagnosticsDialog').close(); currentView()?.focus(); });
$('#refreshDiagnostics').addEventListener('click', renderDiagnostics);
$('#backup').addEventListener('click', async () => {
  if (confirm('Deseja exportar um backup agora? Escolha “Cancelar” para restaurar um backup existente.')) {
    try { if (await window.drakoria.exportBackup()) showToast('Backup exportado'); } catch { showToast('Não foi possível exportar o backup'); }
    return;
  }
  if (!confirm('Restaurar substituirá a lista de jogos, lembretes e notas atuais. Uma cópia local será criada antes da restauração. Continuar?')) return;
  try {
    if (await window.drakoria.importBackup()) {
      state.games = await window.drakoria.listGames();
      await refreshReminders();
      renderList();
      showToast('Backup restaurado');
    }
  } catch (error) { showToast(error.message || 'Não foi possível restaurar o backup'); }
});
$('#splitView').addEventListener('click', () => {
  if (!state.activeId) return showToast('Abra um jogo antes de dividir a tela');
  if (state.splitId) {
    document.querySelector(`[data-view-id="${state.splitId}"]`)?.classList.remove('active', 'split-secondary');
    els.stack.classList.remove('split');
    state.splitId = null;
    $('#splitView').textContent = '▯';
    $('#splitView').title = 'Dois jogos lado a lado';
    return showToast('Tela dividida desativada');
  }
  const choices = state.games.filter((game) => game.id !== state.activeId);
  if (!choices.length) return showToast('Adicione outro jogo para usar a tela dividida');
  $('#splitGame').replaceChildren(...choices.map((game) => Object.assign(document.createElement('option'), { value: game.id, textContent: game.name })));
  $('#splitDialog').showModal();
});
$('#closeSplit').addEventListener('click', () => $('#splitDialog').close());
$('#cancelSplit').addEventListener('click', () => $('#splitDialog').close());
$('#splitForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const secondary = state.games.find((game) => game.id === $('#splitGame').value);
  if (!secondary) return;
  state.splitId = secondary.id;
  const view = createWebview(secondary);
  view.classList.add('active', 'split-secondary');
  els.stack.classList.add('split');
  $('#splitView').textContent = '▣';
  $('#splitView').title = 'Fechar tela dividida';
  $('#splitDialog').close();
  showToast(`Tela dividida: ${secondary.name}`);
});
$('#closeNotes').addEventListener('click', () => { $('#notesDialog').close(); currentView()?.focus(); });
$('#cancelNotes').addEventListener('click', () => { $('#notesDialog').close(); currentView()?.focus(); });
function setSidebarCollapsed(collapsed) {
  $('.app-shell').classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem('sidebar-collapsed', String(collapsed));
  $('#toggleSidebar').setAttribute('aria-label', collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral');
  $('#toggleSidebar').title = collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral';
}
$('#toggleSidebar').addEventListener('click', () => {
  setSidebarCollapsed(!$('.app-shell').classList.contains('sidebar-collapsed'));
  requestAnimationFrame(() => currentView()?.focus());
});
$('#closeDialog').addEventListener('click', () => { els.dialog.close(); currentView()?.focus(); });
$('#cancelDialog').addEventListener('click', () => { els.dialog.close(); currentView()?.focus(); });

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const existing = state.games.find((game) => game.id === $('#gameId').value);
  try {
    const saved = await window.drakoria.saveGame({
      id: $('#gameId').value || undefined,
      createdAt: existing?.createdAt,
      name: $('#gameName').value,
      url: $('#gameUrl').value,
      username: $('#gameUsername').value,
      password: $('#gamePassword').value,
      autoFill: $('#gameAutoFill').checked,
      muted: existing?.muted || false,
      keepActive: $('#gameKeepActive').checked,
      favorite: existing?.favorite || false,
      zoomFactor: existing?.zoomFactor || 1,
      icon: existing?.icon || '',
      color: state.selectedColor
    });
    const index = state.games.findIndex((game) => game.id === saved.id);
    if (index >= 0) state.games[index] = saved; else state.games.push(saved);
    const oldView = document.querySelector(`[data-view-id="${saved.id}"]`);
    if (oldView && existing?.url !== saved.url) oldView.remove();
    els.dialog.close();
    renderList();
    openGame(saved.id);
    showToast('Jogo salvo com segurança');
  } catch (error) {
    $('#formError').textContent = error.message || 'Não foi possível salvar o jogo.';
  }
});

$('#reminderForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const saved = await window.drakoria.saveReminder({
      title: $('#reminderTitle').value,
      intervalMinutes: Number($('#reminderInterval').value)
    });
    state.reminders.push(saved);
    $('#reminderTitle').value = '';
    $('#reminderError').textContent = '';
    renderReminders();
    showToast('Lembrete criado');
  } catch (error) {
    $('#reminderError').textContent = error.message || 'Não foi possível salvar o lembrete.';
  }
});

$('#notesForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const game = activeGame();
  if (!game) return;
  try {
    await window.drakoria.saveNote(game.id, $('#gameNotes').value);
    await window.drakoria.saveCompanion(game.id, state.companion);
    $('#notesDialog').close();
    currentView()?.focus();
    showToast('Notas salvas');
  } catch (error) {
    $('#notesError').textContent = error.message || 'Não foi possível salvar as notas.';
  }
});

$('#back').addEventListener('click', () => { const view = currentView(); if (view?.canGoBack()) view.goBack(); });
$('#forward').addEventListener('click', () => { const view = currentView(); if (view?.canGoForward()) view.goForward(); });
$('#reload').addEventListener('click', () => currentView()?.reload());
$('#zoomOut').addEventListener('click', () => changeZoom(-0.1));
$('#zoomIn').addEventListener('click', () => changeZoom(0.1));
$('#zoomReset').addEventListener('click', () => changeZoom(0, true));
$('#mute').addEventListener('click', async () => {
  const game = activeGame();
  const view = currentView();
  if (!game || !view) return;
  const previous = Boolean(game.muted);
  const muted = !previous;
  try {
    view.setAudioMuted(muted);
    await saveGameChanges(game, { muted });
    updateMuteButton();
    renderList();
    showToast(muted ? 'Som da aba desativado' : 'Som da aba ativado');
  } catch {
    try { view.setAudioMuted(previous); } catch {}
    showToast('Não foi possível alterar o som');
  }
});
$('#favorite').addEventListener('click', async () => {
  const game = activeGame();
  if (!game) return;
  try {
    await saveGameChanges(game, { favorite: !game.favorite });
    updateFavoriteButton();
    renderList();
    showToast(game.favorite ? 'Jogo favoritado' : 'Jogo removido dos favoritos');
  } catch { showToast('Não foi possível atualizar o favorito'); }
});
$('#external').addEventListener('click', () => { const view = currentView(); if (view) window.drakoria.openExternal(view.getURL()); });
$('#credentials').addEventListener('click', showCredentials);
$('#fillNow').addEventListener('click', async () => {
  const game = activeGame();
  if (!game?.hasCredentials) return showToast('Nenhuma credencial salva');
  const filled = await fillGameCredentials(game);
  els.popover.classList.add('hidden');
  showToast(filled ? 'Credenciais preenchidas' : 'Abra a página de login do jogo');
});
$('#editGame').addEventListener('click', () => openDialog(activeGame()));
$('#updateLogin').addEventListener('click', () => openDialog(activeGame(), true));

$('#gameSearch').addEventListener('input', (event) => {
  state.search = event.target.value;
  renderList();
});

document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
  const game = activeGame();
  const field = button.dataset.copy;
  if (!game?.hasCredentials) return showToast('Nenhum dado salvo');
  let value = '';
  try { value = (await window.drakoria.getCredentials(game.id))[field] || ''; } catch {}
  if (!value) return showToast('Nenhum dado salvo');
  await navigator.clipboard.writeText(value);
  showToast(field === 'password' ? 'Senha copiada' : 'Usuário copiado');
}));

$('#loginPassword').addEventListener('click', () => {
  const password = els.popover.dataset.password || '';
  if (!password) return;
  state.passwordVisible = !state.passwordVisible;
  $('#loginPassword').textContent = state.passwordVisible ? password : '••••••••••';
});

$('#deleteGame').addEventListener('click', async () => {
  const game = activeGame();
  if (!game || !confirm(`Remover “${game.name}” da sua lista? A sessão e o progresso local serão preservados.`)) return;
  const clearSession = confirm('Também apagar a sessão local, incluindo cookies e possíveis dados salvos deste jogo? Esta ação não pode ser desfeita.');
  await window.drakoria.deleteGame(game.id, clearSession);
  document.querySelector(`[data-view-id="${game.id}"]`)?.remove();
  state.games = state.games.filter((entry) => entry.id !== game.id);
  state.activeId = null;
  els.popover.classList.add('hidden');
  els.toolbar.classList.add('hidden');
  els.stack.style.display = 'none';
  els.welcome.classList.remove('hidden');
  document.title = 'OvelhaoHb Idles Hub';
  renderList();
  showToast(clearSession ? 'Jogo e sessão removidos' : 'Jogo removido; sessão preservada');
});

document.addEventListener('click', (event) => {
  if (!els.popover.classList.contains('hidden') && !els.popover.contains(event.target) && !$('#credentials').contains(event.target)) els.popover.classList.add('hidden');
});

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key === 'Tab' && state.games.length > 1) {
    event.preventDefault();
    const currentIndex = Math.max(0, state.games.findIndex((game) => game.id === state.activeId));
    const direction = event.shiftKey ? -1 : 1;
    openGame(state.games[(currentIndex + direction + state.games.length) % state.games.length].id);
  }
  if (event.ctrlKey && ['+', '=', '-'].includes(event.key)) {
    event.preventDefault();
    changeZoom(event.key === '-' ? -0.1 : 0.1);
  }
  if (event.ctrlKey && event.key === '0') {
    event.preventDefault();
    changeZoom(0, true);
  }
});

(async function init() {
  setSidebarCollapsed(localStorage.getItem('sidebar-collapsed') === 'true');
  const [version, games, reminders] = await Promise.all([window.drakoria.getVersion(), window.drakoria.listGames(), window.drakoria.listReminders()]);
  $('#appVersion').textContent = `Versão ${version}`;
  state.games = games;
  state.reminders = reminders;
  renderColors();
  renderList();
  renderReminders();
  window.drakoria.onRemindersChanged(() => refreshReminders().catch(() => {}));
  window.drakoria.onUpdateStatus(showUpdateStatus);
  window.drakoria.checkForUpdates().then(showUpdateStatus).catch(() => {});
})();
