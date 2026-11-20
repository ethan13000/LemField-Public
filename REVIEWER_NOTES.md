# LemField 1.1 reviewer notes

Version 1.1.0 targets Firefox desktop 140+ and Chromium 120+. These are unsigned/unpublished submission candidates. Firefox's existing store ID is preserved despite the LemField name restoration. The development manifest keeps its distinct local ID. Internal storage keys, backup formats and database names retain compatibility with previous builds.

Build with Node.js 18+ using `node scripts/build-release.cjs`. No network or downloaded build dependency is needed. Both runtime ZIPs have manifest.json at their root. `LemField-1.1-source.zip` contains readable source, tests and build scripts. Browser-specific manifests, Chromium popup/account wording and privacy text are produced by the builder. No minification or remote executable code is used.

Permissions and data processing are described in PRIVACY.md and chrome-store/PRIVACY.md. Main-world deck writes share Moxfield's page-origin trust boundary, validate ownership/actions and verify readback. Failed or uncertain writes are not automatically retried. Bulk actions require a reviewed plan. Print-only choices do not modify a deck. The rename does not request new permissions.

The 1.1 review addressed saved-token migration/cleared-choice preservation, upload reset races, associated-token warnings, coalesced artwork lookup errors, cancelled/prefetch search races, ramp detection and saved-rule migration. Patch notes describe user-facing changes.

No supported public native Moxfield refresh interface was identified in the integration. Extension snapshots/panels update after writes; forced post-dialog reloads have been removed. An explicit refresh notice remains for the native list. Private framework state is not modified to manufacture a refresh.

Validation limitations: authenticated live deck/browser interaction and layout, generated-token edition API support, browser-account sync delivery and physical printer calibration remain unverified in this environment. jsdom/Playwright dependency installation failed with registry EACCES; dependency-backed DOM/browser checks and an online dependency audit could not be completed. Open Print tabs must be reopened after picker-upload changes. This review does not certify absence of bugs or security issues.
