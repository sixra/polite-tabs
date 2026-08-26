# AMO listing copy

Paste-ready text for the listed submission at
<https://addons.mozilla.org/developers/addon/submit/distribution>.

Listing text is metadata, not part of the package, so it can be edited at any time without
submitting a new version. Keep it in sync with `README.md`.

## Name

Polite Tabs

## Add-on URL

`polite-tabs`

## Summary

Max 250 characters, and **URLs are rejected**: addons-server declares
`summary = NoURLsField(max_length=250)`.

> Frees the memory held by tabs you have not touched in a while. They stay in your tab strip
> and reload when you return, with scroll position and anything you typed still there. No
> network access, and it never runs code on the pages you visit.

## Description

> Polite Tabs unloads tabs you have not looked at for a while, so a browser holding dozens of
> tabs stops costing dozens of tabs' worth of memory.
>
> Nothing is closed and nothing is lost. An unloaded tab stays where it is and reloads when
> you click it, with your scroll position and anything you typed still there.
>
> It works as soon as you install it, unloading after 30 minutes. Set that anywhere from a few
> minutes to a few weeks, or switch the timer off and unload only when you ask.
>
> Never unloaded: the tab you are looking at, tabs playing audio, tabs with unsaved changes,
> and any site or tab group you exempt.
>
> The toolbar badge counts the tabs still using memory. Click it to see them, jump to one, or
> unload it now.

## Categories

**Tabs** (`tabs`) only, though AMO allows three. Privacy & Security is scoped to blocking ads,
preventing tracking and managing redirects, none of which this does.

## Compatibility

Firefox only. Leave **Firefox for Android** unticked: `tabs.discard` is not available there, so
the add-on cannot work on Android at all.

## Images

- Add-on icon: `icon-128.png`. One upload; AMO derives the 32 and 64 previews from it.
- Screenshots: none yet. Take them from a real profile, not the preview harness.

## Links

- Homepage: <https://github.com/sixra/polite-tabs>
- Support site: <https://github.com/sixra/polite-tabs/issues>
- Support email: dev.sr@tuta.com
- Contributions: only the domains in `VALID_CONTRIBUTION_DOMAINS` are accepted. Leave blank
  until a page exists and resolves.

## License

MIT, matching `LICENSE` in this repository.

## Privacy policy

Not required. AMO asks for one only when data is transmitted from the user's device, and this
add-on transmits nothing: no network access, no content scripts, settings in `storage.local`.

## Notes for reviewers

> No build step. The .xpi is a plain zip of the source files, unmodified: build.sh copies a
> fixed list (manifest.json, shared.js, background.js, panel.html, panel.js, icon.svg, LICENSE,
> README.md) into a temporary directory and zips it. Nothing is minified, bundled, transpiled
> or generated, so the package contents are identical to the sources and no source upload is
> required.
>
> Why each permission is needed:
>
> - tabs: reads lastAccessed, url and discarded state to decide which tabs to unload, and
>   calls tabs.discard. url is also matched against the user's keep-loaded hostname list.
> - tabGroups: read-only. tabGroups.query lists groups so the user can exempt them. update and
>   move are never called.
> - alarms: a single periodic alarm drives the idle sweep.
> - storage: settings in storage.local. Nothing is synced.
> - menus: two right-click items, "Never unload this site" and "Never unload this tab".
>
> There are no content scripts, no host permissions, no network requests and no remote code.
> The manifest declares data_collection_permissions: none.
>
> To exercise it: open the toolbar popup, set the timeout to a few minutes under Settings,
> switch away from a tab and wait. The badge counts tabs still loaded, so it falls, and the
> popup lists the ones still using memory.
