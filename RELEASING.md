# Releasing

Operator notes. Nothing here is usable without the AMO account that owns the add-on, which is
why it is not in the README.

## Commands

```bash
./build.sh            # unsigned package, for local testing
./build.sh --lint     # Mozilla's own linter, no packaging
./build.sh --sign     # lint, then sign for self-distribution (unlisted)
./build.sh --publish  # lint, then submit to the public AMO store (listed)
```

`build.sh` is the single source of truth for what ships. Signing reads `WEB_EXT_API_KEY` and
`WEB_EXT_API_SECRET` from the environment, falling back to the macOS Keychain items
`amo-api-key` and `amo-api-secret`.

```bash
security add-generic-password -a "$USER" -s amo-api-key -U -w
security add-generic-password -a "$USER" -s amo-api-secret -U -w
```

`-w` last, with no value, so it prompts instead of putting the secret in shell history.

## Cutting a release

1. Update `CHANGELOG.md`: rename the entry to `X.Y.Z (YYYY-MM-DD)` and add a fresh section.
2. Bump `version` in `manifest.json`.
3. `./build.sh --lint`, and fix anything it finds.
4. Commit `chore: release vX.Y.Z`, tag `git tag -a vX.Y.Z -m "vX.Y.Z"`, push with
   `--follow-tags`.
5. `./build.sh --publish`, or upload the `.xpi` through the Developer Hub.

Listing copy lives in `LISTING.md`.

## Things that bite

- **`--publish` is a one-way door for a version number.** Listed submissions go to human review,
  and a version can never be reused, across either channel. A rejected `1.0.0` means the fix
  ships as `1.0.1`.
- **Never delete the add-on on AMO.** Deleting adds its ID to a permanent block list, so the ID
  can never be submitted again. `polite-tabs@sixra.dev` was lost this way; the current ID is
  `politetabs@sixra.dev`. If a submission is wrong, upload a new version instead.
- **Tag before publishing**, so the verification recipe in the README has something to point at.
- **`web-ext lint` reports one expected warning**, `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`.
  The linter falls back to `gecko.strict_min_version` when `gecko_android` is absent, so it checks
  `data_collection_permissions` (Android 142) against our 140 even though the add-on is desktop
  only. Do not silence it by adding `gecko_android` back: that is what offers the add-on on
  Android, where `tabs.discard` does not exist and the background page throws on load.
