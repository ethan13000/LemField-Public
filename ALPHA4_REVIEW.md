# LemField Alpha 4 — source review and release checks

Extension/package version: **1.10.58**. This review covers the current unzipped working source, including the printing screen, artwork uploads, feature controls, Card Explorer, search exclusion, and authenticated deck bridge.

## Fixed during this sweep

- Export quantities are validated and the 1,500-card limit is enforced before allocating expanded card copies. This prevents excessive allocations from malformed deck quantities.
- Export responses must contain a valid card array with string names and finite, nonnegative integer quantities.
- The popup's disabled printing button now respects `hidden` even though its normal CSS uses flex layout.
- Failed settings saves restore both the checkbox and its in-memory setting instead of leaving them inconsistent.
- Disabling automatic EDHREC recommendations no longer prevents the separate printing shortcut from opening its picker.
- The search exclusion script can initialize on the deck overview before SPA navigation into search. Leaving the original deck/search restores any results it hid and removes its control. Search on a different deck still requires a refresh to initialize that deck's list.
- The printing shortcut regression fixture now supplies browser storage and waits for async initialization, so it tests the installed handlers.

Recent checkbox fixes are retained: a fresh extension-owned input copies native sizing, maintains independent state, and stops click/input/change propagation to Moxfield's handlers. The new regression checks exercise both on and off state transitions; they do not establish real Firefox event behavior.

## Security observations

- Card names, errors and uploaded filenames are not inserted as HTML. Runtime source review found no `innerHTML`, `eval`, or `new Function` rendering sink.
- Custom artwork accepts PNG/JPEG/WebP, checks a 20 MB input limit, and requires successful image decoding. Images remain in this export tab's memory; they are not uploaded to Moxfield or external services and are not persisted. Reloading/closing the tab loses custom images. Extremely large decoded images can still consume considerable memory.
- Public card-service requests omit credentials and use fixed service endpoints. URL allowlists and credential-isolation regressions pass.
- Authenticated add/printing actions retain owned-deck checks, exact card matching, bounded deadlines and uncertain-write warnings. Authorization remains in the Moxfield page closure.
- The existing same-origin page-message bridge is not an authentication boundary against scripts already running on Moxfield. Such scripts can forge page commands. The ownership checks do not remove that architectural trust limitation; see SECURITY_REVIEW.md.
- This is a source review and regression pass, not a penetration test or a guarantee that every vulnerability has been found.

## Checks

Passed on this Windows workspace using Node 24.17.0:

- All runtime JavaScript syntax checks.
- Manifest references resolve to existing files.
- All 17 dependency-free suites in `npm.cmd run test:data`, including settings/prototype defense, regex guards, bridge ownership and credentials, printing changes, request deadlines, artwork recovery and the new Alpha 4 regressions.
- Alpha 4 regressions cover checkbox on/off state, native input styling without cloning native behavior, export bounds before allocation, and oldest-first sorting with unknown dates last.
- Release ZIP entries are read back and compared byte-for-byte with their source files. `manifest.json` is at the ZIP root.

Not completed here:

- The full DOM suite requires missing jsdom. Offline `npm ci` failed because required dependency packages are not cached. Browser tests also need Playwright/browser dependencies.
- Dependency advisory auditing requires network access to the package registry; its result is not covered by the source review.
- Live Firefox layout, real click/keyboard event behavior, current Moxfield/EDHREC responses and authenticated deck writes require manual verification. The recent user screenshots show the installed toolbar, not verification of all controls.

## Install

Extract `LemField-Alpha-4.zip` into a folder. In Firefox, open `about:debugging#/runtime/this-firefox`, load that folder's `manifest.json`, and refresh Moxfield tabs. For an already loaded folder, replace its files and use Reload. Export settings before changing installations. This is an unsigned temporary add-on.

The release ZIP contains runtime code and review/user documents only. Browser profiles, HAR captures, caches, logs, development dependencies and historical archives are excluded.
