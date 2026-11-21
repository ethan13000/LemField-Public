# LemField 1.1 Alpha 2

New Moxfield editor compatibility update. Package version: 1.1.0.2.

- Added an always-visible Card Explorer button to the deck requirements header. Explorer controls use the filled purple button styling in both the header and native toolbar.
- Made deck requirements collapsible with a saved open/closed state, matching the native section style. Sidebar links and Settings reopen it automatically.
- Restored Card Explorer beside the new editor's View Options control, including after toolbar redraws. The legacy Find and add placement remains supported.
- Moved Print to the top deck action menu, rather than the Prices section.
- Anchored requirements to the new Mana Curve Analysis section.
- Limited Add basic lands to the main deck list, excluding Considering and analysis copies.
- Updated card and group checkboxes to use the new editor's exact card hashes and board-specific row keys. Identical printings in different boards remain separate; commander, token and curve-analysis rows stay excluded from bulk selection.
- Fixed adventure and double-faced card selection when the displayed face name differs from the full API card name.
- Updated printing-menu targeting to keep exact row identity through Edit → Switch printing. Alt bypass, original-selector access and navigation cleanup remain supported.

Build with `npm run build:alpha2` or `node scripts/build-release.cjs --alpha2`. Firefox and Chromium ZIPs plus a reproducible source ZIP are written to `../1.1 alpha 2/`. Firefox Alpha 2 preserves the development add-on ID used by the working directory; it is an unsigned temporary-install build. Keep Chromium's unpacked folder path unchanged when updating.

The supplied saved HTML was inspected locally. Regression fixtures use small synthetic examples of its structure; the full capture and account information are excluded from packages and publication. The new editor's layouts not present in that sample, authenticated live browser interaction, DOM/Playwright suites and account-sync delivery remain unverified. Existing no-reload behavior remains: LemField panels update, while Moxfield's native list may need Refresh now. See VALIDATION.json with the package for check results.
