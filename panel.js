const el = id => document.querySelector(`#${id}`);

// A popup can be dismissed at any moment, so every edit persists immediately
// rather than waiting for a Save button the user may never reach.
let settings = { ...DEFAULTS };

// Capped on the count rather than the total, so switching unit never rewrites the
// number. 999 weeks is ~19 years, and it keeps the product inside a safe integer.
const MAX_COUNT = 999;

// Every list starts as a shortlist; long ones hide behind their own toggle. The tab
// list is the reason the popup gets opened, so it shows more than the settings lists.
const SHORTLIST = { tabs: 4, hosts: 2, groups: 2 };
const expanded = { tabs: false, hosts: false, groups: false };

el('amount').max = MAX_COUNT;
el('amount').addEventListener('change', applyTiming);
el('units').addEventListener('change', applyTiming);
el('manual-only').addEventListener('change', applyTiming);

el('unload-now').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'unload-now' });
  await renderTabs();
});

el('host-add').addEventListener('click', addHost);
el('host-input').addEventListener('keydown', event => {
  if (event.key === 'Enter') addHost();
});

toggles({ tabs: renderTabs, hosts: renderHosts, groups: renderGroups });
refresh();

function toggles(renderers) {
  for (const [key, render] of Object.entries(renderers)) {
    el(`${key}-more`).addEventListener('click', () => {
      expanded[key] = !expanded[key];
      render();
    });
  }
}

// The one place that knows about shortening: fills a container and its toggle together.
function fill(key, items, row) {
  const list = el(key);
  const more = el(`${key}-more`);

  list.replaceChildren(...(expanded[key] ? items : items.slice(0, SHORTLIST[key])).map(row));
  more.hidden = items.length <= SHORTLIST[key];
  more.textContent = expanded[key] ? 'Show fewer' : `Show all ${items.length}`;
}

async function refresh() {
  settings = await readSettings();
  renderTiming();
  showTiming();
  renderHosts();
  await renderGroups();
  await renderTabs();
}

async function persist() {
  await browser.storage.local.set(settings);
  const saved = el('saved');
  saved.classList.add('show');
  clearTimeout(saved.timer);
  saved.timer = setTimeout(() => saved.classList.remove('show'), 1800);
}

function renderTiming() {
  const { count, size } = splitTimeout(settings.idleMinutes || DEFAULTS.idleMinutes);

  el('amount').value = count;
  el('manual-only').checked = !settings.idleMinutes;

  el('units').replaceChildren(...UNITS.map(([unit, , label]) => {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'unit';
    radio.value = unit;
    radio.checked = unit === size;

    const chip = document.createElement('label');
    chip.className = 'chip';
    chip.append(radio, label);
    return chip;
  }));

  describeUnits();
  setTimingEnabled(!!settings.idleMinutes);
}

// Each unit says what picking it would mean, rather than restating its own name.
function describeUnits() {
  const count = amountTyped();

  for (const chip of el('units').querySelectorAll('.chip')) {
    const size = Number(chip.querySelector('input').value);
    const [, noun] = UNITS.find(([unit]) => unit === size);
    chip.title = plural(count, noun);
  }
}

function amountTyped() {
  return Math.min(MAX_COUNT, Math.max(1, Math.round(Number(el('amount').value)) || 1));
}

// The amount is meaningless while unloading is manual, so put it out of reach.
function setTimingEnabled(enabled) {
  document.querySelector('.amount').setAttribute('aria-disabled', String(!enabled));
}

function applyTiming() {
  const manual = el('manual-only').checked;

  if (manual) {
    settings.idleMinutes = 0;
  } else {
    const size = Number(el('units').querySelector(':checked').value);
    const count = amountTyped();

    settings.idleMinutes = count * size;
    if (count !== Number(el('amount').value)) el('amount').value = count;
    describeUnits();
  }

  setTimingEnabled(!manual);
  showTiming();
  persist();
}

function showTiming() {
  const from = settings.idleMinutes;
  if (!from) {
    el('idle-hint').textContent = 'Tabs are only unloaded when you ask.';
    return;
  }

  // Short timeouts get the range, because the sweep interval is a visible share of
  // them. On long ones it is noise, so say it plainly instead.
  el('idle-hint').textContent = from < 60
    ? `A tab unloads ${from} to ${from + Math.ceil(sweepMinutes(from))} minutes after you last used it.`
    : `A tab unloads about ${timeoutLabel(from)} after you last used it.`;
}

// Both lists need one, and this is the only place PRESETS becomes markup.
function presetSelect(current, { withDefault = false } = {}) {
  const select = document.createElement('select');
  if (withDefault) select.append(new Option('Default', ''));
  for (const minutes of PRESETS) select.append(new Option(timeoutLabel(minutes), String(minutes)));

  select.value = current === undefined ? '' : String(current);
  return select;
}

/* Tabs */

async function renderTabs() {
  const tabs = await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  const loaded = tabs.filter(tab => !tab.discarded);

  el('loaded').textContent = loaded.length;
  el('unloaded').textContent = tabs.length - loaded.length;
  el('tabs-hint').textContent = loaded.length ? 'Most idle first. Click one to jump to it.' : '';

  // Most idle first: the ones closest to being unloaded anyway.
  loaded.sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0));
  fill('tabs', loaded, tabRow);
}

function tabRow(tab) {
  const title = document.createElement('button');
  title.className = 'title';
  title.type = 'button';
  title.textContent = tab.title || bareHostname(tab.url) || 'Untitled';
  if (tab.title) title.title = tab.title;
  title.addEventListener('click', async () => {
    await browser.tabs.update(tab.id, { active: true });
    await browser.windows.update(tab.windowId, { focused: true });
    window.close();
  });

  // A title alone often does not say which site it is: "Inbox (23)", "Dashboard".
  const host = document.createElement('span');
  host.className = 'host';
  host.textContent = [bareHostname(tab.url), sinceLabel(tab.lastAccessed)]
    .filter(Boolean).join(' \u00b7 ');

  const text = document.createElement('div');
  text.className = 'text';
  text.append(title, host);

  const drop = document.createElement('button');
  drop.className = 'drop';
  drop.type = 'button';
  drop.textContent = 'unload';
  // Firefox refuses to discard the selected tab, so do not offer it as an action.
  drop.disabled = tab.active;
  if (tab.active) drop.title = 'The tab you are viewing cannot be unloaded';
  drop.setAttribute('aria-label', `Unload ${tab.title || 'tab'} now`);
  drop.addEventListener('click', async () => {
    // Anything holding unsaved work is refused too, silently, so re-render either way.
    await browser.tabs.discard(tab.id).catch(error => console.warn('discard refused', error));
    await renderTabs();
  });

  const row = document.createElement('li');
  row.className = 'tab';
  row.append(text, drop);

  // Audible tabs can be unloaded, and doing so stops the sound, so mark which they are.
  if (tab.audible) {
    const audio = document.createElement('span');
    audio.className = 'audio';
    audio.textContent = '\u266a';
    audio.title = 'Playing audio';
    host.prepend(audio, ' ');
  }

  return row;
}

function sinceLabel(lastAccessed) {
  if (!lastAccessed) return '';
  const minutes = Math.floor((Date.now() - lastAccessed) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

/* Sites */

function addHost() {
  const hostname = bareHostname(el('host-input').value);
  // Unparseable input stays in the field to be corrected, rather than vanishing.
  if (!hostname) return;

  // New entries start at never, which is what this list did before it had times.
  if (!(hostname in settings.sites)) {
    settings.sites[hostname] = 0;
    renderHosts();
    persist();
  }
  el('host-input').value = '';
  el('host-input').focus();
}

function renderHosts() {
  fill('hosts', Object.entries(settings.sites), ([hostname, minutes]) => {
    const name = document.createElement('span');
    name.textContent = hostname;

    const select = presetSelect(minutes);
    select.setAttribute('aria-label', `Unload ${hostname} after`);
    select.addEventListener('change', () => {
      settings.sites[hostname] = Number(select.value);
      persist();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${hostname}`);
    remove.addEventListener('click', () => {
      delete settings.sites[hostname];
      renderHosts();
      persist();
    });

    const row = document.createElement('li');
    row.className = 'row';
    row.append(name, select, remove);
    return row;
  });
}

/* Groups */

async function renderGroups() {
  // Optional chaining is belt and braces: tabGroups needs Firefox 139 and the floor is 140.
  const found = (await browser.tabGroups?.query({})) ?? [];

  fill('groups', found, group => {
    const title = group.title || 'Untitled group';

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.setProperty('--swatch', group.color);

    const name = document.createElement('span');
    name.textContent = title;

    const select = presetSelect(settings.groups[group.id], { withDefault: true });
    select.setAttribute('aria-label', `Unload ${title} after`);
    select.addEventListener('change', () => {
      if (select.value === '') delete settings.groups[group.id];
      else settings.groups[group.id] = Number(select.value);
      persist();
    });

    const row = document.createElement('div');
    row.className = 'group';
    row.append(swatch, name, select);
    return row;
  });
}
