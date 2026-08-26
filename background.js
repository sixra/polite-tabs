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

  const { keepLoaded } = await browser.storage.local.get(DEFAULTS);
  browser.menus.update(KEEP_SITE, {
    title: keepLoaded.includes(hostname) ? `Allow unloading ${hostname}` : `Never unload ${hostname}`,
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

  const { keepLoaded } = await browser.storage.local.get(DEFAULTS);
  await browser.storage.local.set({
    keepLoaded: keepLoaded.includes(hostname)
      ? keepLoaded.filter(h => h !== hostname)
      : [...keepLoaded, hostname],
  });
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
  const { idleMinutes } = await browser.storage.local.get(DEFAULTS);
  // Never means never: drop the alarm rather than waking up to decide not to act.
  if (!idleMinutes) return browser.alarms.clear(ALARM);

  const periodInMinutes = sweepMinutes(idleMinutes);

  // create() restarts the countdown, so leave an already-correct alarm alone.
  const existing = await browser.alarms.get(ALARM);
  if (existing?.periodInMinutes === periodInMinutes) return;

  browser.alarms.create(ALARM, { periodInMinutes });
}

function shouldUnload(tab, cutoff, { keepLoaded, keepGroups }) {
  // autoDiscardable only stops the browser's own unloading, so honour it here too.
  if (tab.autoDiscardable === false) return false;
  if (!tab.lastAccessed || tab.lastAccessed > cutoff) return false;
  if (keepGroups.includes(tab.groupId)) return false;

  const hostname = bareHostname(tab.url);
  return !keepLoaded.some(h => hostname === h || hostname.endsWith('.' + h));
}

async function sweep({ ignoreIdle = false } = {}) {
  const settings = await browser.storage.local.get(DEFAULTS);
  if (!ignoreIdle && !settings.idleMinutes) return;

  // Infinity means every tab is old enough, which is what "unload now" asks for.
  const cutoff = ignoreIdle ? Infinity : Date.now() - settings.idleMinutes * 60 * 1000;

  const tabs = await browser.tabs.query({
    url: ['http://*/*', 'https://*/*'],
    discarded: false,
    active: false,
    audible: false,
  });

  for (const tab of tabs) {
    if (!shouldUnload(tab, cutoff, settings)) continue;
    // Only guards the race where the tab closed between query and discard.
    await browser.tabs.discard(tab.id).catch(() => {});
  }

  await refreshBadge();
}
