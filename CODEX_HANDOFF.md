# Codex handoff: LemField

## Desktop continuation (November 1, 2026)

Current source is version 1.10.57 on `main`. New work adds persistent popup feature toggles, native deck-search exclusion with an excluded-entry count, and card-sheet PDF export. The export opens from the popup or the deck toolbar beside Buy Deck. Its separate page supports Letter/A4, spacing, margins, skipping basic lands, quantities, sideboard cards, and cut guides; use the browser's Save as PDF at 100% scale. Double-faced cards currently print fronts only.

Card Explorer now uses five columns on desktop, responsive smaller layouts, compact name/stat spacing, inclusion and lift together, hidden type/category labels, and All Cards as the initial category when Top Cards is absent or empty.

Validation: syntax/diff checks passed, as did the dependency-free deck-client and art tests and sheet-fit calculations. Live Firefox/Moxfield rendering remains unverified; the native search filter relies on result DOM structure and has been adjusted based on user feedback to include action controls. Full DOM/network suites require missing jsdom. Feature toggles apply at content-script startup, so reload Moxfield tabs after changing them. Infinite combo detection was researched but not implemented.

On the desktop, pull `main`, load/reload this folder's manifest in Firefox, and refresh Moxfield tabs. The untracked `Microsoft/Windows` directory is unrelated local runtime data and is not included in the commit.

This bundle captures the working LemField Firefox extension in `project/` and its local test and fixture files. The source package reports version **1.10.56** (`project/package.json`). The separate `LemField-reviewed-v1.10.2.zip` is an older reviewed package and is included as a historical release artifact; it is not the current source.

## Project contents

- `project/`: current extension source, manifest, package metadata, user guide, and security review.
- `project/tests/`: source tests and browser fixtures. Browser profile folders, dependency caches, generated logs, and captured browsing archives are excluded.
- `project/LemField-Alpha-*.zip`: prior alpha packages retained in the working project.
- `LemField-reviewed-v1.10.2.zip`: reviewed package from the workspace root.

## Current work reflected in the source

The current README documents requirements tracking, EDHREC integration, card search, deck actions, artwork handling, printing selection, filtering, and responsive dialogs. The November 1 printing-selection update replaces a matching card in the open deck while preserving quantity, rejects ambiguous or missing matches, and avoids adding a new copy. It also removes the personal popularity sort and local selection counts.

## Validation and known limits

The package defines `npm test`, `npm run test:data`, and `npm run test:browser`. The current README reports that some data/placement checks pass, while the full DOM/browser suite needs `jsdom` and Playwright dependencies. Live Moxfield authenticated behavior, current external service formats, and real Firefox layout still need live verification. Read the project README and `SECURITY_REVIEW.md` before making behavioral changes.

## Handling note

The source workspace had HAR captures and browser profile data under temporary/test directories. Those were intentionally left out of this handoff because they can contain session or personal browsing data and are not needed to resume development. No changes were pushed to GitHub as part of creating this bundle.
