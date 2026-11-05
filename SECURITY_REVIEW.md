# Alpha 7 current review

See [ALPHA7_RELEASE_REVIEW.md](ALPHA7_RELEASE_REVIEW.md) and [VALIDATION.md](VALIDATION.md) for version 1.10.60, fixes, test results and remaining risks. The dated material below is historical.

# LemField 1.10.59 security and reliability review

Reviewed November 2, 2026. This is a source and regression review, not a penetration test or a claim that the extension is vulnerability-free.

## Scope

Reviewed extension manifests and permissions, runtime message handlers, the Moxfield page-world bridge, settings import and validation, external API requests and response parsing, rendering sinks, card/image discovery and queues, route observers, and printing/export state.

## Changes from this review

| Area | Finding | Change |
| --- | --- | --- |
| Rendering performance | The feature-style observer queried every eligible extension host in the full document after every page DOM mutation. | It now batches mutation records and scans only newly added page subtrees. Full scanning is reserved for startup; settings changes still update already attached shadow roots. |
| Network response memory | The authenticated Moxfield bridge and page snapshot path could buffer an unexpectedly large body. | Added an 8 MiB ceiling to these two page-world paths. The shared background limiter was rolled back while the reported EDHREC and Scryfall failures are checked against the installed version. |
| Source hygiene | Generated browser profiles used by local Edge tests were not excluded from the source repository. | Added the three profile directories and `.tmp/` to `.gitignore`. Existing files were left intact. |

## Existing controls reviewed

- Settings imports have a 5 MB limit, use schema sanitization, reject reserved profile/rule IDs, and ignore inherited overrides. Regex input is conservatively screened for known catastrophic forms and scanned text is bounded.
- Deck writes use a fixed Moxfield API origin, check that the destination deck is owned, require an exact card or printing match, bound request deadlines and pending actions, and do not automatically retry uncertain writes.
- Extension-to-background requests validate inputs and use fixed service origins. Third-party requests omit credentials.
- UI content is assembled with DOM nodes and `textContent`; no `innerHTML`, `eval`, or `new Function` sink was found in production JavaScript. External links use `noopener noreferrer`, and card/image URLs are constrained to expected service origins.
- Artwork downloads use a shared four-request visible-image queue. Major response arrays, caches, and request timeouts constrain normal operation.

## Remaining risks and limits

- The authenticated Moxfield bridge runs in the page's main world. Same-origin scripts can observe or forge its `postMessage` commands. Deck ownership checks and strict action validation limit impact, but cannot authenticate LemField as the exclusive caller against a compromised Moxfield page.
- Regex screening is heuristic, not a proof that every imported custom expression has bounded runtime. A worker with a hard execution timeout would provide stronger isolation.
- Background EDHREC and Scryfall responses do not yet have a streaming byte ceiling. Their parser arrays, timeouts, and cache limits remain in place while the shared reader regression is investigated.
- Local browser-profile directories are now ignored for future Git additions, but Git is unavailable in this environment, so whether any existing profile or HAR files are already tracked could not be confirmed. The packaging script includes only explicit source files and does not include browser profiles or HAR captures.
- `npm test` could not start because `jsdom` is not installed. The dependency-free `npm run test:data` suite passed all 30 remaining suites. Browser rendering and authenticated Moxfield writes were not live-tested.
- Dependency advisory scanning could not be completed because the development dependencies are not installed and network access is unavailable.

## Verification

- `npm.cmd run test:data`: all 30 remaining suites passed.
- JavaScript syntax checks and manifest path validation were run for the active source and runtime copies.
- Frozen ZIP archives were not modified.
## November 3 cross-device print-settings update

Print-only edition preferences and token quantities now use the browser vendor's extension sync service. This is separate from Moxfield's account storage. The sync module and JSON backups allow only validated deck/section/name keys, Scryfall printing IDs, edition metadata, and token quantities. Credentials, arbitrary storage keys, uploaded artwork and undo histories are excluded. Backups are validated before import, with a 5 MB input cap and 5,000-setting limit. Imports and synchronization do not invoke deck-write APIs.

Sync retains local copies and revision/tombstone metadata. Timestamp/device-ID ordering resolves conflicts; it is not a collaborative database or an account authentication mechanism. Browser sync quotas can prevent uploads, and the popup reports these errors while retaining local choices. Live browser-account delivery, temporary-install behavior and cross-device UI rendering remain unverified. Automated two-device tests cover migrations, offline conflicts, resets, retries and backup rejection; they are not a security certification.
