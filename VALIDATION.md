# Alpha 7 validation

Version 1.10.60, reviewed November 5, 2026.

- All 43 dependency-free test scripts passed after review fixes.
- Runtime JavaScript syntax checks passed.
- Targeted PDF checks cover physical page size, cross-reference byte offsets, filename sanitization, image-decode timeout and the encoded-image memory ceiling.
- Browser API tests cover Firefox passthrough and Chromium worker startup/restart, message routing and offscreen parsing.
- Package validation checks both manifests, every referenced runtime resource, browser-specific files and every ZIP entry against its staged SHA-256 hash.

## Unavailable validation

The three jsdom suites cannot run because jsdom is not installed. An offline npm ci attempt failed on an uncached dependency. Playwright/browser suites cannot run without the missing browser-test dependencies, and the connected Windows browser's URL-policy enforcement is unsupported. No live authenticated deck/token writes or two-device account-sync tests were run.

Offline npm audit returned zero cached advisories. An online audit could not reach registry.npmjs.org; this is not evidence that no current advisories exist. The shipped runtime has no third-party npm dependencies.

## Commands

- npm run test:data
- npm test (requires jsdom)
- npm run test:browser (requires Playwright and a browser installation)
- npm run build:alpha7

The two release ZIPs are unsigned/unpacked alpha builds. Do not describe this release as bug-free or security-certified.
