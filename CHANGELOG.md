# Changelog

Notable changes, newest first. Versions follow [semver](https://semver.org).

## 1.1.0 (unreleased)

### Added

- **Per-site and per-group timeouts.** A site or tab group can now have its own time rather than
  only being exempt: pick from 5 minutes through 1 week, or Never. Groups left on *Default*
  follow the main timing. A group rule wins over a site rule, since a group is something you
  built by hand.

### Changed

- **One timeout control everywhere.** The main timing is now the same list of choices the
  per-site and per-group rows use, replacing the number field and unit buttons. *Only unload
  when I ask* moved into that list, so the checkbox is gone.
- **Tab rows show the site.** The hostname and idle time now sit under the title, because a title
  alone often does not say which site it is ("Inbox (23)", "Dashboard").

## 1.0.1 (2026-08-26)

### Changed

- **Desktop Firefox only.** Firefox for Android is not supported: `tabs.discard` is not
  available there, so tabs cannot be unloaded on Android.

## 1.0.0 (2026-08-26)

First release. Unloads tabs you have not looked at in a while, so a browser holding 30 open
tabs stops costing 30 tabs' worth of memory.

### Added

- **Idle unloading**: any tab untouched past the timeout is unloaded, and reloads when you
  return with scroll position and form contents intact. The timeout is a number plus a unit,
  minutes through weeks, default 30 minutes. *Only unload when I ask* turns the timer off.
- **Exemptions**: the tab you are viewing, tabs playing audio, tabs with unsaved changes, and
  tabs holding an open dialog. Most are enforced by the browser rather than by this add-on.
  Pinned tabs are not exempt.
- **Keep-loaded sites**: hostnames added one at a time. A pasted URL is reduced to its hostname
  as you add it, and subdomains are included.
- **Keep-loaded groups**: tick a tab group to exempt every tab in it. Zen folders are tab
  groups, so they appear here too. A ticked group survives restarts and renames.
- **Per-tab exemption**: hold a single tab loaded without protecting its whole hostname.
- **Unload all**: a panel button, and `Alt+Shift+U`, to sweep immediately instead of waiting.
- **Right-click menu**: *Never unload this site* and *Never unload this tab*, both toggling.
  `Alt+Shift+K` does the site one.
- **Panel**: one page serving as popup, options page and first-run tab. Reports loaded against
  unloaded, lists loaded tabs most-idle-first, and lets you jump to one or unload it now.
  Settings save as you change them.
- **Toolbar button**: badged with the number of tabs still loaded, refreshed when a tab's
  unloaded state actually changes rather than on a timer.

### Notes

- Requires Firefox 140, which is what `tabGroups` (139) and the data collection declaration
  (140) need.
- Unloaded tabs are not dimmed by default, and no extension can change that. See *Seeing it
  work* in the README.
