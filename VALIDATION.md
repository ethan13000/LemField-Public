# LemField 1.10.57 validation — November 1, 2026

Imported from the supplied 1.10.56 source bundle. Historical alpha and reviewed packages are retained unchanged in downloads.

Changes since the handoff:
- Retain successful card metadata even when no artwork URL exists, so details, filters and Oracle identity grouping continue to work.
- Edition-update errors ask the user to check the deck instead of incorrectly promising the original entry is unchanged after an uncertain write.
- Update stale printing mocks to exercise PUT edition changes, preserved quantities, expired deadlines, replay handling, credential isolation, wrong printing/quantity and uncertain writes.
- Update DOM mocks for storage access, accessible action controls, explicit destination selection and four-card summaries; wait for asynchronous profile rendering in browser tests.
- Repair an EDHREC test that could exit before its pending mocked request completed; a deadline now catches incomplete runs.
- Add a four-viewport browser fixture runner, lock dependencies, and provide reproducible release packaging.

Passed: the full 19-suite npm test command, desktop/mobile browser regression, all 127 dialog fixture checks, JavaScript syntax checks, manifest file-reference checks, and ZIP integrity checks.

Validation uses Node 24.19.0, jsdom 26.1.0, Playwright 1.62.1 and system Chromium. Run:

```sh
npm ci
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
npm run package
```

For Playwright-managed Chromium, run `npx playwright install chromium` and omit the executable override. Dependency-free tests are available separately with `npm run test:data`. The browser suite includes desktop/mobile requirements layouts and 127 mocked dialog/filter/artwork checks across 1440x1000, 390x844, 320x568 and 1000x500 viewports. External service requests are mocked and no real deck is modified. jsdom cannot reload pages; the DOM fixture tolerates only that known unsupported navigation operation.

Not verified: live Firefox extension installation/rendering, signed-in Moxfield writes, or current external EDHREC/Scryfall responses. The Firefox ZIP is for temporary installation through about:debugging; permanent installation requires Mozilla signing. The security review remains a historical review of 1.10.2, not certification of this release.
