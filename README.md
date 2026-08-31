# Polite Tabs

Unloads tabs you have not touched in a while, so a browser with 30 open tabs stops costing 30
tabs' worth of memory. Unloaded tabs stay in the tab strip and reload when you return, with
scroll position and form contents intact.

Default is 30 minutes. It works the moment you install it; the settings page is optional.

**Tested on Zen only.** See [Browser support](#browser-support).

## Permissions and scope

- **Permissions: `tabs`, `tabGroups`, `alarms`, `storage`, `menus`.** Nothing else. `tabGroups`
  is read-only here: it lists your groups so you can exempt them, and never modifies one.
  `menus` adds the two right-click items and nothing more.
- **No content scripts.** It never injects anything into any page you visit. It reads tab
  metadata (last accessed time, audible, URL) through the browser API.
- **No host permissions and no network access.** It cannot make requests, and there is no
  server to make them to.
- **Settings stay in `storage.local`.** Nothing syncs anywhere.

## What never gets unloaded

Mostly enforced by the browser itself, not by this add-on:

- The tab you are looking at.
- Tabs playing audio.
- Tabs with unsaved changes, meaning any page with a `beforeunload` handler, the same check
  the browser runs when you close a tab.
- Tabs with an open dialog.
- Any hostname on your keep-loaded list.
- Any tab in a group you ticked, which in Zen means a folder.

Pinned tabs **are** unloaded. They reload when clicked, same as any other tab.

## Settings

Click the toolbar button. The same panel is also the options page in `about:addons`, and it
opens in a tab on first install. Changes save as you make them, since a popup can be dismissed
at any moment.

At the top it reports how many tabs are loaded against how many are unloaded, then lists the
loaded ones most-idle-first with how long each has sat. Click a title to jump to that tab, or
**unload** to drop it now without waiting for the timer. **Unload all** sweeps everything
eligible immediately, ignoring the timer.

Right-clicking a page or tab offers **Never unload this site** and **Never unload this tab**,
which is quicker than typing a hostname into the settings. The same two actions have keyboard
shortcuts, `Alt+Shift+U` to unload all and `Alt+Shift+K` to keep the current site, both
rebindable from `about:addons`.

The tab list shows four entries and the settings lists two, each with a toggle for the rest,
and settings sit behind one disclosure. Firefox clamps popups to 800x600 and scrolls anything
taller, so the resting layout stays well inside that.

It deliberately does not show per-tab memory. Firefox exposes no such API to extensions, and the
add-ons that show it inject a script into every page you visit, which this one refuses to do.
Idle time is the honest substitute, and it is the better predictor of what goes next anyway.

- **Unload a tab after**: a number plus a unit, minutes through weeks, up to 999 of any unit.
  Default 30 minutes.
- **Only unload when I ask** turns the timer off entirely, including its alarm, leaving
  unloading to the button, the shortcut and the right-click menu.
- **Site timeouts**: type a hostname and press Enter or click Add. A full URL is fine, it is
  reduced to its hostname as you add it, so you can see what was actually stored. Subdomains are
  included, so `example.com` also covers `app.example.com`. Each site gets its own timeout, from
  5 minutes to a week, or Never. Added sites start at Never.
- **Group timeouts**: give any tab group its own timeout, or leave it on *Default* to follow the
  timing above. Zen folders are tab groups, so they show up here. Group ids are derived from a
  creation timestamp that the session store persists, so a rule survives restarts and renames;
  deleting and recreating a group makes a new one.

A group rule beats a site rule, on the grounds that a group is something you assembled by hand
while a site rule is a broad default.

### Seeing it work

Firefox dims a tab only when *you* unload it by hand, so by default a tab this add-on unloaded
looks exactly like a loaded one. An extension cannot change that: the attribute Firefox styles
on is not exposed to the extension API, and the add-ons that manage it do so by replacing the
tab with a page of their own, which loses your scroll position and needs permission to read
every site you visit.

The toolbar button exists for this reason: its badge counts tabs still loaded, and clicking it says
how many are still using memory. It refreshes when a tab's unloaded state changes rather than on
a timer, so the number is not a stale snapshot.

To dim the tabs themselves, set `browser.tabs.fadeOutUnloadedTabs` to `true` in `about:config`.

### Timing

Tabs are checked four times per interval, capped at every 5 minutes, so the lag stays under a
quarter of whatever you set. A 30 minute timeout unloads between 30 and 35 minutes; a 2 minute
one unloads within about 30 seconds of the mark. The cap exists because the background page is
torn down after 30 seconds of inactivity, so every check is a cold start, and waking constantly
in an add-on meant to save resources would be self defeating.

## Install

From [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/polite-tabs/). It is signed
by Mozilla, so no preference changes are needed and any Firefox-based browser will take it.

To run it from source, use `about:debugging` -> This Firefox -> **Load Temporary Add-on** and
pick `manifest.json`. That needs no signing and disappears on restart. `./build.sh` produces an
`.xpi` if you want one; release mechanics live in [RELEASING.md](RELEASING.md).

## Verify the published build

The claim above is only worth something if you can check it, so here is how. `build.sh` does no
transformation at all: it copies a fixed list of files and zips them. That means the package on
AMO should be identical to this source.

```bash
# an .xpi is a zip
unzip -d published polite_tabs-*.xpi

# compare against a checkout of the matching tag
for f in manifest.json shared.js background.js panel.html panel.js icon.svg LICENSE README.md; do
  cmp "$f" "published/$f" && echo "$f ok"
done
```

Everything should match byte for byte. `published/META-INF/` is Mozilla's signature and has no
counterpart here.

Check out the tag matching the version you downloaded, not `main`: docs move between releases,
so comparing a released package against the tip will flag `README.md` even when every line of
code is identical.

## Updates

Firefox updates it from AMO automatically. There is deliberately no `update_url`: listed add-ons
are not allowed one, and Firefox falls back to checking AMO when a manifest omits it.

## Browser support

| Browser | Status |
|---|---|
| Zen | Tested |
| Firefox 140+, LibreWolf | Should work, untested |
| Chrome, Brave, Vivaldi, Opera | Not yet |
| Firefox for Android | Not possible, `tabs.discard` does not exist there |

Chromium is planned rather than ruled out: the APIs this relies on exist there too, so it is a
small change rather than a rewrite. It stays off the list until it has been tested.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
