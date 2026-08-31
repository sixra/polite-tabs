const ALARM = 'sweep';
const KEEP_SITE = 'keep-site';
const KEEP_TAB = 'keep-tab';

// Registering onStartup is what makes Firefox start this event page at browser
// launch; alarms are in-memory and cleared on shutdown, so nothing else would.
browser.runtime.onStartup.addListener(reschedule);
browser.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    browser.tabs.create({ url: browser.runtime.getURL('panel.html') });
  }
});
browser.alarms.onAlarm.addListener(() => sweep());
browser.storage.onChanged.addListener(reschedule);

// Filtered to discard flips, so ordinary browsing does not wake the event page.
browser.tabs.onUpdated.addListener(refreshBadge, { properties: ['discarded'] });
browser.tabs.onRemoved.addListener(refreshBadge);

browser.commands.onCommand.addListener(async command => {
  if (command === 'unload-now') return sweep({ ignoreIdle: true });
  if (command === 'keep-site') return toggleSite(await activeTab());
});

// Menus are recreated on every event page start, so clear first to avoid duplicate ids.
browser.menus.removeAll().then(() => {
  browser.menus.create({ id: KEEP_SITE, title: 'Never unload this site', contexts: ['page', 'tab'] });
  browser.menus.create({ id: KEEP_TAB, title: 'Never unload this tab', contexts: ['page', 'tab'] });
});

browser.menus.onShown.addListener(async (info, tab) => {
  const hostname = bareHostname(tab?.url ?? '');
  if (!hostname) {
    // Reset rather than return: the titles otherwise still name the previous tab's site.
    browser.menus.update(KEEP_SITE, { title: 'Never unload this site', enabled: false });
    browser.menus.update(KEEP_TAB, { title: 'Never unload this tab', enabled: false });
    browser.menus.refresh();
    return;
  }

  const { sites } = await readSettings();
  browser.menus.update(KEEP_SITE, {
    title: sites[hostname] === 0 ? `Allow unloading ${hostname}` : `Never unload ${hostname}`,
    enabled: true,
  });
  browser.menus.update(KEEP_TAB, {
    title: tab.autoDiscardable === false ? 'Allow unloading this tab' : 'Never unload this tab',
    enabled: true,
  });
  browser.menus.refresh();
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === KEEP_SITE) return toggleSite(tab);
  if (info.menuItemId === KEEP_TAB) {
    await browser.tabs.update(tab.id, { autoDiscardable: tab.autoDiscardable === false });
  }
});

browser.tabGroups?.onRemoved.addListener(async ({ id }) => {
  const { groups } = await readSettings();
  if (!(id in groups)) return;

  const next = { ...groups };
  delete next[id];
  await browser.storage.local.set({ groups: next });
});

browser.runtime.onMessage.addListener(message => {
  if (message?.type === 'unload-now') return sweep({ ignoreIdle: true });
});

reschedule();
refreshBadge();

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function toggleSite(tab) {
  const hostname = bareHostname(tab?.url ?? '');
  if (!hostname) return;

  // The menu is a two-way switch, so it only ever writes "never" or clears the rule.
  // Anything more granular belongs in the panel.
  const { sites } = await readSettings();
  const next = { ...sites };
  if (next[hostname] === 0) delete next[hostname];
  else next[hostname] = 0;
  await browser.storage.local.set({ sites: next });
}

async function refreshBadge() {
  // Same filter as the panel's "loaded" figure, so the badge and popup never disagree.
  const loaded = await browser.tabs.query({
    url: ['http://*/*', 'https://*/*'],
    discarded: false,
  });
  await browser.action.setBadgeText({ text: String(loaded.length) });
}

async function reschedule() {
  // The shortest live rule sets the cadence, so a 5 minute group is not checked hourly.
  const shortest = shortestTimeout(await readSettings());
  // Nothing to wake for: every timeout is "never".
  if (!shortest) return browser.alarms.clear(ALARM);

  const periodInMinutes = sweepMinutes(shortest);

  // create() restarts the countdown, so leave an already-correct alarm alone.
  const existing = await browser.alarms.get(ALARM);
  if (existing?.periodInMinutes === periodInMinutes) return;

  browser.alarms.create(ALARM, { periodInMinutes });
}

function shouldUnload(tab, now, settings, ignoreIdle) {
  // autoDiscardable only stops the browser's own unloading, so honour it here too.
  if (tab.autoDiscardable === false) return false;

  // A rule of 0 means never, and outranks "unload all". The global timer being off
  // does not, which is why this asks for the rule rather than the effective timeout.
  const rule = ruleFor(tab, settings);
  if (rule === 0) return false;
  if (ignoreIdle) return true;

  const minutes = rule ?? settings.idleMinutes;
  if (!minutes) return false;
  return !!tab.lastAccessed && tab.lastAccessed <= now - minutes * 60 * 1000;
}

async function sweep({ ignoreIdle = false } = {}) {
  const settings = await readSettings();
  const now = Date.now();

  const tabs = await browser.tabs.query({
    url: ['http://*/*', 'https://*/*'],
    discarded: false,
    active: false,
    audible: false,
  });

  for (const tab of tabs) {
    if (!shouldUnload(tab, now, settings, ignoreIdle)) continue;
    // Only guards the race where the tab closed between query and discard.
    await browser.tabs.discard(tab.id).catch(() => {});
  }

  await refreshBadge();
}
