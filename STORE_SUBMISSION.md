# Submit LemField 1.1

Run `npm run check:release`, then `npm run build:release`. The output is `../release 1.1/`:

- `LemField-1.1-Firefox.zip`: Firefox upload candidate, existing store add-on ID preserved.
- `LemField-1.1-Chromium.zip`: Chrome Web Store upload candidate.
- `LemField-1.1-source.zip`: readable reviewer source for both platforms.
- `SHA256SUMS.txt`: hashes for all three archives.

Use the browser-specific store listing and privacy text, plus PATCH_NOTES_1.1.md. Review REVIEWER_NOTES.md and complete authenticated browser smoke tests on a test deck before uploading. Verify add/remove/printing and explicit refresh behavior, token variants, custom artwork, PDF/duplex output, and browser-account sync. Store screenshots and developer contact fields must reflect the actual listing.

For Firefox, update the existing listing associated with `moxfield-plus@ethan13000`; display the new name LemField. For Chromium, update the existing store item to preserve its store extension ID. Do not create a replacement listing merely for the name change. Review store privacy disclosures against the included policies. No submission, approval or signing is performed by these scripts.
