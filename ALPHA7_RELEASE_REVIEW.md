# LemField Alpha 7 - code review and release notes

Version: 1.10.60. Review date: November 5, 2026.
Source: the user-confirmed moxfield-requirements testing folder. Old Alpha 5/6 folders and ZIPs are not authoritative source.

## Scope

Reviewed all runtime JavaScript syntax and the manifest, page-world bridge and deck actions, external service request paths, URL/rendering boundaries, settings/import/regex handling, print preference migration/sync, token identity, custom uploads, image queues, Explorer lifecycle, export/PDF state and Firefox/Chromium packaging. This is a source/regression review, not a penetration test or live-browser certification.

## Findings fixed

| Area | Problem | Fix |
| --- | --- | --- |
| Token custom uploads | IndexedDB records omitted tokenSourceId. Variant-aware keys then failed to match on reopening Print. | Persist the original token identity and test reopening/separation. |
| Token migration | Same-name token-key compatibility could accept conflicting three-component variant keys. | Only migrate a legacy name key or an exactly matching variant identity. |
| Remote response memory | Public service JSON/HTML could be buffered without a byte ceiling. | Shared streaming body reader: 16 MiB JSON and 8 MiB HTML/text ceilings; cancel oversized streams before parsing. Loaded by both browser backgrounds. |
| PDF reliability | Image decoding could wait indefinitely; encoded page images had no total memory bound. | 20-second image decode deadlines, 128 MiB encoded-image ceiling and canvas cleanup on success/failure. |
| Export state | Old print/PDF controls could become enabled after preview invalidation during an operation. | Track the prepared generation; only re-enable controls for a current prepared preview. |
| Upload precedence | A newer upload made from Print could be masked on reopening by an older picker upload. | Clear the stale picker override after successfully persisting the newer Print upload. |
| Explorer overhead | Every background render rebuilt EDHREC recommendation membership. | Cache the immutable membership set once per Explorer opening. |
| Regression fixtures | Two tests still extracted old control arrays or lacked new menu mocks. | Update those fixtures while retaining their original behavior assertions. |

## Security controls checked

- No production eval, new Function, innerHTML, outerHTML or insertAdjacentHTML sink found. User/service text is rendered with DOM nodes/textContent; external link/image helpers constrain destinations.
- Deck changes use a fixed API origin, owned-deck checks, exact source/edition matching, deadlines, bounded pending/replay maps and read-back verification. Uncertain writes are not automatically retried.
- Settings/print imports validate allowed schemas and keys before writes. Token variants remain separate. Browser sync excludes credentials, uploaded artwork and undo history.
- Third-party service requests omit credentials. Packaged code is local; no remotely loaded executable scripts or runtime npm dependencies are shipped.
- Firefox retains its fixed extension ID. Chromium adds only the existing offscreen permission for inert HTML parsing; parser requests validate sender/context and size.
- Packages use explicit runtime/document allowlists. HAR files, source tests, node_modules, browser profiles, caches, repository metadata and local handoffs are excluded.

## Validation

- 43/43 dependency-free scripts pass, including the new bounded-response and PDF tests.
- All runtime JavaScript syntax checks pass.
- Firefox and Chromium release manifests, resource references and ZIP file hashes are checked by the Alpha 7 builder.
- The three jsdom suites are blocked by the missing dependency. Offline npm ci failed on an uncached package. Browser/Playwright validation and live authenticated writes are not completed.
- Offline npm audit reports zero cached advisories; the online advisory endpoint is unreachable. No current-advisory clearance is claimed.

## Known risks and testing priorities

1. Native token edition updates use the existing card-edition PUT endpoint after resolving the original token's Moxfield edition family. Mocked tests cover payloads, rejection and verification, but the endpoint's support for generated tokens is still not live-confirmed. Test on a test deck. Do not report success merely because a request returns 200; the read-back guard must pass.
2. The authenticated page bridge shares Moxfield's main world. Same-origin page scripts can observe/forge its messages; it cannot authenticate LemField against a compromised Moxfield page. Authorization is not exported to third-party services or print backups.
3. Native DOM selectors, artwork replacement and the original-selector adapter depend on Moxfield's UI. Live Firefox/Chromium rendering, sticky toolbar behavior and native token flows need verification. An explicit original-selector action is a UI fallback, not a direct edition update.
4. Browser-account delivery of print settings is unverified; export/import is available. Sync quotas and matching extension IDs apply. Uploads remain device-local, and uninstalling temporary extensions can erase local data.
5. Picker and Print uploads use different persistence stores. The precedence/reset issue above is fixed, but an already-open Print tab does not yet live-subscribe to picker upload changes; reopen it after uploading in the picker.
6. Illustration tags use a private Scryfall endpoint and reflect loaded printings only. Trigger/role matching and staple exemptions are heuristics, not a complete Magic rules or recommendation engine.
7. PDFs are raster sheets at 300 DPI, not selectable-text documents. Large exports may hit the new 128 MiB ceiling; export fewer cards/copies. Double-faced cards print the front face.

## Major changes since Alpha 6

- Expanded Explorer searches/triggers, persistent toolbar access, clearer in-deck states, basic-land exclusion and contextual rapid-add reminders.
- Safer token variants and exact printing previews, with experimental direct token edition updates and explicit print-only fallback.
- Direct PDF export, per-token quantities and print-settings sync/JSON transfer.
- Visible Your Decks card counts and improved preview/loading responsiveness.

Unsigned/unpacked alpha builds. Keep feedback and limitations attached to the release; do not claim bug-free or vulnerability-free software.

## Archive verification

Firefox: 40 allowlisted files. Chromium: 44 allowlisted files. The builder checks manifest/page references, syntax, decompression, CRC and file SHA-256 values; independent .NET decompression and file-hash comparison also passed. ALPHA7_SHA256SUMS.txt records final ZIP hashes. Neither archive contains HAR captures, tests, dependency folders, local handoffs, profiles or cached user data.
