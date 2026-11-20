# Install LemField 1.1

## Firefox 140+

The Firefox ZIP is an unsigned release candidate. For a temporary installation, extract `LemField-1.1-Firefox.zip`, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select the extracted `manifest.json`. Temporary add-ons must be loaded again after restarting Firefox. Permanent installation requires Mozilla signing or an approved store listing; no store approval is claimed.

The store package preserves the existing `moxfield-plus@ethan13000` add-on ID. Its visible name is LemField. The development copy retains `moxfield-requirements@local.extension`. Avoid running both copies together. Export requirements settings and print preferences before changing installations; artwork remains local and is not in JSON preference backups.

## Chromium 120+

Extract `LemField-1.1-Chromium.zip`. Open `chrome://extensions` (or the equivalent page in Edge, Brave or Opera), enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`. Keep the same folder path for subsequent updates to retain the unpacked extension identity. Safari is not supported. The ZIP can also be used for Chrome Web Store submission; no upload or approval has been performed.

## Updating and using decks

Reload the extension after replacing its files, then refresh existing Moxfield tabs once to load the new scripts. Normal card additions and printing changes no longer force a page reload when their dialog closes. Extension panels refresh from Moxfield; use **Refresh now** if Moxfield's native card list still shows an older state. That explicit page refresh can discard unsaved native edits, so finish those first.

Test deck writes on a test deck. If a write times out or reports uncertainty, check the deck before retrying. Bulk actions include every copy of the selected exact printing and require review before applying. Generated-token edition updates depend on Moxfield's API.

For physical double-faced printing, choose **Both faces**, select the intended flip edge and print at 100% scale with browser headers/footers off. Front/back pages are paired, with blank back slots preserving alignment. Test one sheet first. Custom artwork replaces fronts. Reopen an existing Print tab after changing uploaded artwork in a picker.
