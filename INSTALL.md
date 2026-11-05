# Install LemField Alpha 7

## Upgrade

Export settings and print preferences as a backup first. Keep your current extension installed; uninstalling may clear local artwork and settings. Replace files in the folder you already load, then reload the extension and refresh Moxfield tabs. Alpha 7 keeps the Firefox extension ID unchanged. The active development/testing folder on the author's workstation is moxfield-requirements; packaged copies are separate builds.

## Firefox

1. Extract LemField-Alpha-7-Firefox.zip.
2. Open about:debugging#/runtime/this-firefox.
3. Choose Load Temporary Add-on and select the extracted manifest.json.
4. Refresh Moxfield.

Temporary add-ons need loading again after Firefox restarts. Permanent Firefox installation requires Mozilla signing.

## Chrome, Edge, Brave and Opera

1. Extract LemField-Alpha-7-Chromium.zip.
2. Open the browser's Extensions page and turn on Developer mode.
3. Choose Load unpacked and select the extracted directory.
4. Refresh Moxfield.

The Chromium manifest requires Chromium 120 or later and includes the offscreen permission for inert EDHREC HTML parsing. Unpacked extension IDs can change when the folder path changes; keep the same path to preserve identity and cross-device sync compatibility. Safari is not supported.

## Quick checks

- Open a Moxfield deck and locate Card Explorer beside Find and add cards.
- Ctrl+Shift+click a card/token, or use its Printings context action.
- Test native token edition updates on a test deck; read-back verification is required before the extension reports success.
- Open the extension menu to prepare print sheets, export a PDF, or transfer print settings.

Browser account sync, live Moxfield writes and current native UI compatibility have not been verified in the release environment. See the review report for exact limits.
