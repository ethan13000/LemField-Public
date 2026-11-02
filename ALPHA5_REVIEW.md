# LemField Alpha 5 — Chromium port

Version **1.10.59**. Alpha 4 is preserved as its own release archive.

## Implementation

- Separate manifests: Firefox retains background scripts; Chromium uses a classic Manifest V3 service worker and requires Chromium 120+.
- A small API adapter supplies the Promise APIs used by the shared scripts. Async message handlers explicitly keep their response channel open. Unrelated messages are not claimed, API errors reject, and Firefox retains its native browser API.
- Main-world page bridges remain unchanged. The adapter is loaded only in isolated content scripts and extension UI pages, never into Moxfield's main page world.
- The worker registers its message listeners synchronously on every startup. Caches hold only disposable public service data; cache loss causes a refetch. Authorization and authenticated write operations remain in the page bridge, not the worker.
- Pending Chromium message responses have a two-minute bound. While a worker request is active, a temporary API pulse prevents idle termination; the pulse ends when the request settles or times out. It does not run during idle periods and does not retry deck writes.
- Public EDHREC HTML fallback parsing runs in an offscreen document. Only the extension's own non-tab contexts may request parsing. Operations and input size are bounded. HTML is parsed inertly and never inserted into the live document; parser CSP blocks network resources and permits only bundled scripts.
- Offscreen document creation is shared during concurrent requests and checks for a surviving document after worker restart. It is reused without an idle heartbeat.
- No external polyfill dependency, remotely loaded code, new credential storage, or additional host permissions were introduced. Chromium adds the offscreen permission. Safari remains unsupported.

## Verification

The dependency-free suite includes Chromium-specific regressions for API error propagation, Promise and unclaimed message routing, native Firefox passthrough, synchronous listener registration, fresh worker instances, offscreen HTML fallback routing, concurrent cold creation, parser limits, and sender restrictions. These tests use mocked browser APIs and mocked parsing results; they do not establish installed-browser compatibility.

Runtime syntax, manifest references, UI adapter load order and generated package manifests are checked. ZIP contents are compared with the unpacked build files.

The full DOM/browser suite remains unavailable because jsdom/Playwright dependencies are missing and required packages are not available in the offline cache. No live Chromium extension installation, actual offscreen-document lifecycle, real Firefox rendering, or authenticated Moxfield writes have been verified here. Browser-specific behavior and live service formats require manual testing. Dependency advisory auditing was blocked by registry access during Alpha 4.

The same-origin page-message bridge trust limitation described in SECURITY_REVIEW.md still applies. This release does not claim to authenticate extension commands against malicious scripts already running on Moxfield.

## Build

Run `node scripts/build-alpha5.cjs` from the source directory. It prepares sibling `LemField-Alpha-5-Chromium/` and `LemField-Alpha-5-Firefox/` folders. ZIP the contents of each folder, with its manifest at the archive root. Browser profiles, HAR captures, caches, dependencies, development fixtures and historical release archives are excluded from these runtime packages.

Official references:

- https://developer.chrome.com/docs/extensions/reference/api/offscreen
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- https://developer.chrome.com/docs/extensions/develop/concepts/messaging
