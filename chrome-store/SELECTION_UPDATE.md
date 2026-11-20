# LemField 1.0.1 — select deck cards

## Use

Load the new extension/ folder in Chrome, disable older copies and refresh the Moxfield deck tab. On the native text-list deck view:

1. Check a card entry in the native deck list. The centered bottom toolbar appears only while cards are selected; source boards are inferred from the card entries.
2. Check more entries, use the checkbox next to a rendered group heading, or choose Select listed. Group checkboxes follow the current grouping, show a mixed state for partial selections and clear just that group's selectable entries when unchecked. Only unambiguously mapped editable entries are included.
3. Pick Main deck, Sideboard or Considering in the destination dropdown and choose Move to, or choose Remove selected.
4. Review the names and quantities, then confirm. Each checkbox selects all copies of that exact printing, not a single copy.
5. Refresh the page after completion to refresh Moxfield's native list. The toolbar hides after completion; a separate dismissible notice reports the outcome. Clear removes the current selection and hides the toolbar without editing the deck.

Selection survives native row rerenders, and clears on navigation and deck-data refresh. Checkbox clicks do not open the native card preview/menu.

## Safeguards and limits

- Deck actions require a signed-in session and ownership verified against the user's deck list.
- The page bridge rebuilds the plan from fresh deck data and rejects changed quantities, settings, missing IDs and duplicate selections before writing.
- Moves use exact printing IDs, merge destination quantities, verify the destination copy and then remove the source. They are sequential operations, not an atomic server transaction. If something fails, the operation stops and asks you to check both boards; it never automatically retries a write.
- Read-back checks compare quantities and card properties throughout the editable boards. Unexpected changes stop the batch.
- Selections larger than 20 entries are reviewed together, then processed in sequential batches of at most 20. Progress identifies the current batch. If a batch fails, subsequent batches stop; completed earlier batches are reported and are not retried automatically.
- A checkbox appears only when a native text row can be mapped unambiguously to one board/printing. Repeated names across boards/printings without explicit distinguishing IDs are skipped. Commanders, companions, generated tokens and extension recommendation dialogs are excluded.
- Move cards with tags or custom overrides using Moxfield's native controls; this build refuses those moves rather than discarding customization. Existing destination entries with incompatible properties are also refused.
- Bulk cleanup and bulk selection share a lock in this page. Avoid editing the same deck from another tab during a batch; external changes are checked but cannot be locked across tabs.
- Physical Chrome rendering and signed-in writes against Moxfield's current undocumented API still need a disposable test deck. This build has simulated coverage, not live-service certification.

## Validation

Added tests/deck-selection.cjs and tests/deck-selection-ui.cjs. Coverage includes whole-entry quantity review, owned/session checks, exact-printing moves, destination merges, stale plans, replay protection, copy failure/read-back mismatch, partial removals, custom-card refusal, checkbox isolation, rerender persistence, cancellation and navigation cleanup.

The UI suite uses a small DOM test double. It verifies interaction/state behavior, not actual browser layout or React/Moxfield compatibility. Existing DOM/Playwright dependencies remain unavailable in this environment.

Version 1.0.0 artifacts are preserved. This update is packaged separately in release 1/chrome-1.0.1/.
