# LemField 1.1 patch notes

Released for packaging: November 20, 2026. Extension version: 1.1.0.

## LemField returns

The program is officially called **LemField** again. Updated the popup, dialogs, export labels, privacy text and release packages. Existing storage identifiers and the Firefox store add-on ID remain compatible, so the display-name change preserves data within the same installation.

## Deck building and card updates

- Card additions and printing changes no longer force a page reload when their dialogs close. LemField refreshes its own deck data and panels; use **Refresh now** if Moxfield's native card list is still stale.
- Fresh deck snapshots replace stale previews after native and extension writes. Responses started before a write are prevented from restoring older captured data.
- Deck mutations share a lock to prevent overlapping extension writes. Uncertain or partial failures trigger a read-only refresh without automatically retrying the write.
- Duplicate cleanup stays pinned to the reviewed deck. Navigating during its preview or confirmation cannot redirect cleanup to another deck.
- Native deck-row and group checkboxes support reviewed bulk moves and removals. Each selected printing includes all of its copies; tagged or customized entries retain the conservative move restrictions.
- Deck-list rows show commander names alongside card counts. Printing selection defaults to English, with **Show other languages** available; different borders and treatments remain distinct. Double-faced cards have front/back previews.

## Ramp detection

- Counts typed land searches such as **Nature's Lore**, **Three Visits**, **Skyshroud Claim** and **Farseek**.
- Recognizes additional land plays, land-to-battlefield effects, graveyard land return and mana-producing land enchantments.
- Ordinary lands and searches that only put lands into your hand do not count as ramp.
- Unchanged saved ramp rules update automatically in global and per-deck profiles. Custom criteria, targets and manual overrides are preserved.

## Artwork, searching and printing fixes

- Preserves newer saved token artwork and undo choices during legacy migration; older records cannot restore choices cleared through sync.
- Resetting artwork cancels a pending upload even before its preview appears. A newer upload takes precedence over an older reset.
- Associated-token lookup warnings remain visible instead of disappearing behind a successful preparation message.
- Shared artwork-tag lookups report failures consistently to every waiting caller.
- Canceled searches cannot display old cached results. Delayed settings reads cannot restart background card searches after prefetch is disabled.

## Compatibility and known limits

Requires Firefox 140+ or Chromium 120+. The Firefox candidate is unsigned until Mozilla signing; neither browser package has been submitted to a store by this release preparation.

Moxfield's native list may still require the explicit refresh action. No supported public native-list refresh interface was identified in the integration, and LemField does not modify private framework state to force one. Bulk-selection controls remain locked after a write until the native page is refreshed, avoiding actions against stale rows.

Reopen an existing Print tab after changing uploaded artwork in a picker. Generated-token edition API compatibility, browser-account sync delivery, authenticated live browser behavior and physical duplex alignment still need live testing. Dependency-backed DOM/browser tests and an online dependency audit could not run because registry access was blocked; dependency-free regression and packaging results are recorded with the release.
