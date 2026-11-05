# LemField Alpha 7

Version 1.10.60. Firefox and Chromium test builds for Moxfield deckbuilding.

## Major features

- Custom deck guidelines: strategy profiles, live requirement counts, per-deck targets, matching-card explanations and requirement searches.
- Card Explorer: EDHREC recommendations and Scryfall discovery; searchable roles, tags, triggers and keywords; type, subtype, mana, price and commander-color filters.
- Persistent Explorer toolbar button, deck preview and direct additions to your decks. Added cards stay visible and muted for the current Explorer session; basic lands are excluded.
- Searchable printing browser with artwork groups, edition previews, tags and printing defaults. The original Moxfield selector remains available.
- Separate token variants, saved token quantities and print-only edition choices. Native token edition updates are experimental; use explicit print-only artwork when necessary.
- Proxy sheets with local custom art, Letter/A4, spacing, margins, cut guides, rounded corners, browser printing and direct 300 DPI PDF download.
- Browser sync and JSON transfer for print-edition choices and token quantities. Uploaded artwork stays local.
- EDHREC card information, add-from-Scryfall, Your Decks card counts, feature switches and optional orange highlighting.

See [INSTALL.md](INSTALL.md) for setup. These are unsigned/unpacked test builds, not store releases. Reload the extension and refresh Moxfield after updating.

No Moxfield credentials are included in print backups or sent to EDHREC/Scryfall. Card names and queries are sent to those services when needed. Account synchronization requires the same browser family/account, enabled extension sync and matching extension IDs.

## Downloads

- [Firefox Alpha 7](downloads/LemField-Alpha-7-Firefox.zip)
- [Chromium Alpha 7](downloads/LemField-Alpha-7-Chromium.zip)
- [SHA-256 checksums](downloads/ALPHA7_SHA256SUMS.txt)

## Validation and known limitations

43 dependency-free test scripts and all runtime JavaScript syntax checks passed. DOM/browser suites, live authenticated Moxfield writes and browser-account sync were not verified in the release environment. The online dependency advisory service was unavailable.

Native token edition updates remain experimental and need live testing on a test deck. Moxfield UI changes can affect selectors. Reopen Print after uploading artwork in the picker. Role/trigger matching is heuristic. PDFs use raster images at 300 DPI and print the front face of double-faced cards; large exports may require smaller batches.

## Development

Run `npm ci` and `npm test` for the test suite. Run `npm run build:alpha7` to build and verify both browser ZIPs in the parent directory.
