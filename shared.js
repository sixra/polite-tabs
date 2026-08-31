const DEFAULTS = {
  idleMinutes: 30,
  sites: {},
  groups: {},
};

// Offered on the per-site and per-group pickers. 0 is "never", an option like any other.
const PRESETS = [5, 15, 30, 60, 240, 1440, 10080, 0];

// The one place DEFAULTS is applied, so every caller sees rules in the same shape.
// 1.0.x stored plain arrays under different names; those entries were all "never".
async function readSettings() {
  const stored = await browser.storage.local.get({ ...DEFAULTS, keepLoaded: [], keepGroups: [] });
  const settings = {
    idleMinutes: stored.idleMinutes,
    sites: { ...neverRules(stored.keepLoaded), ...stored.sites },
    groups: { ...neverRules(stored.keepGroups), ...stored.groups },
  };

  // Fold the old arrays in once and drop them. Leaving them would resurrect any entry
  // the user deletes, since they are merged back in on every read.
  if (stored.keepLoaded.length || stored.keepGroups.length) {
    await browser.storage.local.set(settings);
    await browser.storage.local.remove(['keepLoaded', 'keepGroups']);
  }

  return settings;
}

function neverRules(list) {
  return Object.fromEntries((list ?? []).map(key => [key, 0]));
}

// undefined when nothing matches, which is what lets the caller tell an explicit
// "never" rule apart from the global timer being off.
function ruleFor(tab, { sites, groups }) {
  // groupId is -1 on an ungrouped tab, so a stray rule under that key must not match.
  if (tab.groupId != null && tab.groupId !== -1 && tab.groupId in groups) {
    // A group is something you built by hand, so it beats a site rule, which is broader.
    return groups[tab.groupId];
  }

  const hostname = bareHostname(tab.url);
  const match = Object.keys(sites).find(h => hostname === h || hostname.endsWith('.' + h));
  return match === undefined ? undefined : sites[match];
}

// Drives the sweep cadence, so a 5 minute group rule is not checked on a 2 week schedule.
// Zeroes drop out: "never" needs no waking.
function shortestTimeout({ idleMinutes, sites, groups }) {
  const live = [idleMinutes, ...Object.values(sites), ...Object.values(groups)].filter(Boolean);
  return live.length ? Math.min(...live) : 0;
}

// Both the stored list and the tab URL go through this, so a pasted URL still matches.
function bareHostname(value) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const { hostname } = new URL(withScheme);
    // URL() happily parses "!!!" as a hostname, so check it looks like one.
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(hostname)) return '';
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Ascending, which is the order the buttons read in. "m" is avoided as a label
// because it commonly means month.
const UNITS = [[1, 'minute', 'min'], [60, 'hour', 'hour'], [1440, 'day', 'day'], [10080, 'week', 'week']];

function splitTimeout(minutes) {
  // findLast, so the largest evenly dividing unit wins: 4320 reads as 3 days, not 4320 minutes.
  const [size, noun] = UNITS.findLast(([unit]) => minutes % unit === 0);
  return { count: minutes / size, size, noun };
}

function timeoutLabel(minutes) {
  if (!minutes) return 'Never';
  const { count, noun } = splitTimeout(minutes);
  return plural(count, noun);
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

// Wake often enough that a short timeout feels prompt, rarely enough that a long one
// does not wake the background page all day.
function sweepMinutes(idleMinutes) {
  return Math.min(5, Math.max(0.5, idleMinutes / 4));
}
