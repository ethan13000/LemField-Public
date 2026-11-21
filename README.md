# LemField

**Latest release candidate: [1.1 Alpha 2](PATCH_NOTES_1.1_ALPHA2.md)** ? new Moxfield editor compatibility, collapsible requirements and filled Card Explorer buttons.

Store-upload candidates: [Firefox](downloads/store-1.1-alpha2/LemField-1.1-Alpha-2-Firefox.zip) ? [Chromium](downloads/store-1.1-alpha2/LemField-1.1-Alpha-2-Chromium.zip) ? [Reviewer source](downloads/store-1.1-alpha2/LemField-1.1-Alpha-2-source.zip) ? [Checksums](downloads/store-1.1-alpha2/SHA256SUMS.txt). Build with `node scripts/build-release.cjs --alpha2 --store`. Both packages display LemField and version 1.1.0.2. The Firefox store candidate retains the project-recorded ID `moxfield-plus@ethan13000`; confirm that matches the existing AMO listing before upload. No store submission or approval is claimed.

Temporary Firefox test build: [Download](downloads/LemField-1.1-Alpha-2-Firefox.zip) · [Checksum](downloads/SHA256SUMS-1.1-Alpha-2.txt). This uses the separate development add-on ID. The Chromium package and source are shared with the store-upload candidates above.

LemField 1.1 is an independent Moxfield deckbuilding companion for Firefox 140+ and Chromium 120+. It is not affiliated with or endorsed by Moxfield, EDHREC, Scryfall, or Wizards of the Coast.

- Live deck requirements, editable strategy profiles and improved land-ramp detection.
- Card Explorer with EDHREC recommendations and Scryfall discovery; roles, tags, triggers, keywords, colors, mana and price filters.
- Printing selection with appearance grouping, English editions by default, optional other languages, and double-faced previews.
- Basic-land quantity controls, deck-list counts and commander names, duplicate cleanup, and reviewed bulk moves/removals.
- Local card-sheet/PDF export with custom artwork, cut guides and paired double-faced printing.
- JSON preference transfer and optional browser-account sync for print preferences. Uploaded artwork stays local.

Read [1.1 patch notes](PATCH_NOTES_1.1.md), [installation instructions](INSTALL.md), and [privacy policy](PRIVACY.md). Deck changes require a signed-in account and deck ownership. The extension verifies writes and refreshes its own panels without forcing a page reload; Moxfield's native list may still need the explicit Refresh now action. Check the deck before retrying an uncertain write.

Build both browser ZIPs and reviewer source with `npm run build:release` (Node.js 18+; no downloaded build dependencies). Output: `../release 1.1/`. The Firefox store ID is preserved; the development copy has its own existing ID. Older internal storage identifiers are retained so the name change preserves saved data.

Run `npm ci`, then `npm test`. Dependency-free checks: `npm run test:data`; release checks: `npm run check:release`. Live browser behavior, generated-token API compatibility, account-sync delivery and physical duplex calibration require separate testing; see [reviewer notes](REVIEWER_NOTES.md).
