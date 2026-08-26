const DEFAULTS = {
  idleMinutes: 30,
  keepLoaded: [],
  keepGroups: [],
};

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
