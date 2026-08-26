#!/bin/bash
# Package the extension. Modes: (none), --lint, --sign, --publish. See RELEASING.md.
set -euo pipefail
cd "$(dirname "$0")"

# LICENSE and README ship too: the pitch invites people to unzip and read the source, so the
# terms and the argument should travel with it rather than living only on GitHub.
FILES=(manifest.json shared.js background.js panel.html panel.js icon.svg LICENSE README.md)
version=$(grep -o '"version": *"[^"]*"' manifest.json | cut -d'"' -f4)

# Staged, so nothing outside FILES can end up in the package.
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp "${FILES[@]}" "$stage"

if [ "${1:-}" = "--lint" ] || [ "${1:-}" = "--sign" ] || [ "${1:-}" = "--publish" ]; then
    npx --yes web-ext lint --source-dir="$stage"
fi

if [ "${1:-}" = "--lint" ]; then
    exit 0
fi

if [ "${1:-}" = "--sign" ] || [ "${1:-}" = "--publish" ]; then
    # unlisted signs for self-distribution; listed submits to the public AMO store,
    # which is a one-way door for this version number and triggers human review.
    channel=unlisted
    [ "${1:-}" = "--publish" ] && channel=listed
    # Environment first, Keychain otherwise. Checked explicitly below because a missing
    # item leaves the value empty rather than aborting, and web-ext would fail obscurely.
    keychain() { security find-generic-password -a "$USER" -s "$1" -w 2>/dev/null || true; }
    : "${WEB_EXT_API_KEY:=$(keychain amo-api-key)}"
    : "${WEB_EXT_API_SECRET:=$(keychain amo-api-secret)}"

    if [ -z "$WEB_EXT_API_KEY" ] || [ -z "$WEB_EXT_API_SECRET" ]; then
        echo "Missing AMO credentials. Add them to the Keychain, -w last so it prompts:" >&2
        echo '  security add-generic-password -a "$USER" -s amo-api-key -U -w' >&2
        echo '  security add-generic-password -a "$USER" -s amo-api-secret -U -w' >&2
        exit 1
    fi
    export WEB_EXT_API_KEY WEB_EXT_API_SECRET

    npx --yes web-ext sign --source-dir="$stage" --channel="$channel" --artifacts-dir=.
    echo "submitted polite-tabs v$version to the $channel channel"
else
    ( cd "$stage" && zip -q build.xpi "${FILES[@]}" )
    mv "$stage/build.xpi" polite-tabs.xpi
    echo "built polite-tabs.xpi v$version (unsigned; load via about:debugging)"
fi
