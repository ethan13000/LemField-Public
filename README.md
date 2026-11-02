# LemField 1.10.59 — Alpha 5

See [INSTALL.md](INSTALL.md) for Firefox and Chromium installation and [ALPHA5_REVIEW.md](ALPHA5_REVIEW.md) for the Chromium port. See [ALPHA4_REVIEW.md](ALPHA4_REVIEW.md) for the Alpha 4 review and current verification limits. See [VALIDATION.md](VALIDATION.md) for the current checks and [downloads/README.md](downloads/README.md) for versioned packages. Older validation notes below are historical.

## Printing selection fix (November 1)

Selecting an edition in the printing window uses **Use this printing** to replace the matching card entry in the open, owned deck. It preserves the card quantity, refuses ambiguous matches, and never adds a copy when the card is absent. Moxfield's page reloads when the window closes so its native list reflects the change. Moxfield's API is undocumented; replacement uses the edition-update endpoint and verifies the selected edition and quantity afterward. Uncertain outcomes prompt a deck check before retrying.

The personal popularity sort and its local selection counts have been removed.

Card add controls use purple circular + buttons, a separate ellipsis for other decks, and a green check after a successful add. Empty status messages are hidden so they cannot paint a black badge above the artwork. Artwork previews and add controls are sibling elements, and compact-list actions sit with card details instead of overflowing the thumbnail.

Artwork recovery accepts normal/large/PNG/small images and card-face or array image data. Missing artwork is retried even when card metadata has already loaded; failed image URLs try alternate sizes and a bounded lookup. Printing recovery uses the exact Scryfall printing ID so another edition's artwork is not substituted. Image-less lookup results use the short cache lifetime. Local art parsing, recovery and edition-preservation tests pass; live image delivery remains unverified.

The printing dialog adapts to window size: up to 1440px wide with an automatic card grid, two columns on phones and one on very narrow windows. The header and Close button stay visible while the body scrolls. Search/sort controls wrap, tag filters have a bounded scroll area, and narrow or short windows scroll the toolbar with the results instead of pinning it over the cards. Small-screen filter and deck-action buttons have larger hit areas. Browser fixtures include viewport bounds, expanded filter overflow and close-button reachability checks; execution in a real browser remains unverified here.


Printing filters now use an expandable Filter tags menu. Each available tag has + (include) and − (exclude) toggles; click the active toggle again for neutral, or use Clear tag filters. Multiple included tags must all match, and any excluded tag removes an edition before artwork grouping. Available filters include Secret Lair, frame treatments, promo types, finishes, rarity, border color, full art, textless, promo and digital when those properties appear in the loaded data. Finish tags describe availability, not a foil selection for deck additions. Filters and tag choices apply to loaded printing pages.

Ctrl+Shift+click on a native Moxfield card, or right-click a card and choose Printings, now opens LemField's searchable printing window instead of Moxfield's picker when the card name can be identified. Reload the extension and refresh existing Moxfield tabs to load the new shortcut handler. Ordinary clicks and other context-menu actions keep their native behavior. The dialog has its own persistent host so closing a card preview does not remove it. Local gesture regression tests pass; live Moxfield DOM compatibility still requires verification.

The Printings browser on Moxfield now removes repeated printing IDs before grouping artwork. Each artwork group can be expanded to choose an individual set/collector-number edition. Search accepts multiple terms, such as a set code plus collector number or treatment tag. Filters apply to loaded pages; use Load more printings to include later results.

Printing choices replace the existing card in the open deck; they no longer use the deck-add action. Ordinary recommendation additions still add cards using your preferred printing.

Validation: dependency-free data and placement tests pass, including duplicate printing removal, multi-term search, selection forwarding, exact edition payloads, and no write when the edition is missing. Full DOM/browser tests are blocked by missing jsdom/Playwright dependencies, which are not cached for offline installation. Live authenticated Moxfield printing resolution remains to be verified; the API is undocumented.

A requirements tracker and EDHREC card browser for Moxfield Commander decks. The extension shows a compact vertical sidebar on the right and a larger requirements/settings section above the complete analytics row.

## Install for testing

1. Unzip the release into a folder.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. For an existing installation, follow **Upgrade** below to preserve settings. For a first installation, continue.
4. Choose **Load Temporary Add-on** and select `manifest.json` inside the extracted folder.
5. Refresh an open `moxfield.com/decks/...` page using Ctrl+Shift+R.

Temporary extensions are removed on Firefox restart. Permanent installation requires Mozilla signing.

## Using it

- **Deck PDF:** open the extension menu on a Moxfield deck and choose **Export deck to PDF**. Choose US Letter or A4, spacing and margins in millimeters, whether to skip basic lands, print every copy, include sideboard cards, and show cut guides. **Prepare sheets** loads the deck's selected printings and builds a preview at 63 × 88 mm per card. **Print / Save as PDF** opens the browser print dialog; choose Save as PDF, 100% scale, and disable headers and footers. Larger spacing reduces cards per sheet. Mainboard, commanders, and companions are included; considering cards are omitted. Double-faced cards use the front face. Failed images block printing so incomplete sheets are not silently exported.

- **Right sidebar:** live counts and targets; select a requirement to jump to the on-page list of matching cards. Collapse with the arrow.
- **Requirements section:** above the complete analytics row; select a profile, inspect matching cards, or open Settings.
- **Settings:** create a profile from any strategy template, an empty profile, or your active profile. Choose a requirement from the grouped preset selector and set its target; optionally edit its name, conditions, and bounds.
- **Card zones:** choose whether to count mainboard, commanders, sideboard, etc.
- **Export/import:** store settings as JSON. Older saved profiles and overrides remain available when upgrading; deleted profiles remain deleted; all built-in templates remain available when creating profiles.
- **Toolbar popup:** read-only summary of the active Moxfield deck.
- **EDHREC:** card detail pages (`/cards/...`) and deckbuilder card previews show **Top cards first**, followed by **High lift cards**, initially four cards in each group. Show more expands the loaded group by four cards. Commander rank and popular tags appear when available; tag names and deck counts have separate, spaced styling.
- **Card Explorer:** beside the regular EDHREC or Browse EDHREC control on the deckbuilding screen and in card information, opens the integrated card browser. Top cards is the default category. Browse EDHREC categories, high lift, all cards or similar cards; search by name; sort by inclusion, lift, deck count or name; switch between card art and compact list. Hover or keyboard-focus art to see a readable preview up to 400 pixels wide, positioned within the viewport; click for a full-image dialog. Long lists load 24 cards at a time.
- **Deck preview:** Card Explorer shows the current deck beside recommendations (above them on smaller screens), including an active card count for main deck plus commanders. Considering and sideboard cards are excluded from this count. Preview rows show quantities and support hover/click art. Successful additions refresh the preview and count. An explicit Refresh deck preview action reads current data from Moxfield.
- **Current commander:** non-commander cards show EDHREC inclusion, eligible deck counts and lift with the current deck's commander when published. Partner commanders are queried together. A card missing from published recommendations is shown as unavailable, never assumed to have zero inclusion.
- **Similar cards:** a separate section uses EDHREC's Similar Cards screen, rather than treating high-lift cards as similar. Includes art, deck actions and a link to EDHREC when the data is unavailable.
- **Deckbuilding:** Add to deck opens a searchable picker of your Moxfield decks, with main deck, considering or sideboard as the destination. Add to current deck adds one card to the current deck's mainboard and shows its name. The current deck is tracked per tab: on a card page it remains the deck you came from in that tab. Opening a different deck updates it; another tab does not change it. Without a current deck the shortcut is disabled.
- **Deckbuilder search tools:** Card Explorer appears beside EDHREC below the search bar, including when Moxfield uses an internal link. It opens recommendations for the current deck's commander (including partner context), with a near-full-height browser up to 1520 pixels wide, sticky filters, and a separate deck preview. Cards already in the deck are hidden by default; uncheck the filter to include them.
- **Land baseline:** each strategy template includes lands, with a maximum target of 41. The minimum is 32, or 39 for the land-focused template. Existing built-in profiles receive the maximum once; a customized minimum above 41 is preserved with a matching maximum. Exceeding the maximum uses the usual over-target indication and does not prevent adding cards. User-created profiles and subsequent target edits or deliberate deletions are preserved; minimum and maximum remain editable. Presets are general guidelines and may not be optimal for every deck.

### EDHREC data

Reload the temporary extension in Firefox and refresh Moxfield after updating. The manifest permits read-only requests to `json.edhrec.com`, `edhrec.com` and `api.scryfall.com`. Card/commander name slugs are sent to EDHREC; missing art is looked up by card name on Scryfall. Deck contents and credentials are not sent to either service. EDHREC requests are coalesced and successful results are cached in memory for one hour (up to 100 cards). Scryfall requests are lazy, cached and serialized at no more than two requests per second.

The extension checks the commander page first, then the ordinary card page when the commander page is absent. Recommendations are deduplicated and sorted numerically by EDHREC's lift, excluding commander lists. Synergy percentages are not substituted for lift. EDHREC's rendered page supplements missing lift, rank, and tags when possible. Missing statistics and request failures are shown explicitly, with Retry on request failures.

Preview detection supports card dialogs, Bootstrap modals/offcanvas panels, and explicitly named card-preview containers. Moxfield markup and EDHREC's public page formats can change. Live Moxfield preview placement and current EDHREC JSON parsing still need verification in Firefox; local fixtures do not establish compatibility with every live preview layout.

## Role detection limitations

Role presets inspect Oracle text and types using heuristic conditions. Counts are estimates: one card can satisfy several requirements, and a card may have a role that its text does not directly reveal. Matching cards can be inspected; incorrect matches can be excluded. Advanced rules and tags remain available.

## Data access and security

Moxfield deck responses are observed on the page; a read-only background request is used as fallback. Deck writes occur only after an explicit Add to current deck or Add to selected deck action. The page bridge uses the signed-in session observed on Moxfield's own requests; authorization stays in the page closure and is never sent to the extension background, EDHREC or Scryfall. Sign in and refresh Moxfield if your decks cannot be loaded. The bridge checks the destination against your own deck list, resolves an exact card name and adds one copy using your preferred printing. It does not offer general removal or deck-setting changes. Printing selection updates the existing edition after an explicit action. Failed writes are not automatically retried; if the result is uncertain, check the deck before retrying. Refresh Moxfield to update its native deck display after an add.

The extension does not inspect or move Patreon banners. It looks for the analytics area (Hypergeometric Calculator button) to place its large section above the complete analytics row. If that section cannot be located, the large section appears at the end of the page. The EDHREC module uses a debounced DOM observer to detect card previews and card navigation.

## Limitations

Moxfield's undocumented API, preview markup and EDHREC's public page formats may change. Authenticated live additions, current EDHREC parsing and Firefox layout have not been verified in this environment. The Similar Cards data endpoint has a rendered-page fallback and can show an unavailable state if neither is accessible. If deck capture fails, the paste-list fallback cannot infer Oracle text without external card lookups. Syntax and simulated tests are not live-service validation.

## Interface

- Uses the Moxfield-inspired charcoal backgrounds and muted purple for actions.
- Removes progress bars, ring indicators, percentage-based completion summary, and bordered metric cards.
- Requirements are simple rows with counts, targets, and subtle status dots.
- The requirements section and fixed right sidebar have matching muted purple borders.
- Requirements tracking is read-only; recommendation cards offer explicit add-to-deck actions.

## v1.9 fixes and optimization

- Promotes chart placement through flex/grid column wrappers and inserts before the analytics row. Does not modify Moxfield's chart styles or move site content.
- Full-width panel, container-responsive metric rows, and no floating sidebar on phone-sized screens.
- Hides both extension panels outside deck pages; supports navigation from Moxfield home into a deck.
- Replays a deck response captured before the content script was ready, rejects responses for old routes, and ignores stale background results.
- Background reads have a 10-second timeout per endpoint, coalesce concurrent requests, and stop on authorization/rate-limit responses.
- Reuses evaluated results for UI-only updates, caches compiled patterns, and filters selected zones once per evaluation.
- Ramp excludes lands. Migrates unchanged older ramp presets while retaining customized conditions.
- Unknown mana values no longer count as zero; zero-quantity cards are omitted; empty decks clear prior counts.
- Validates imported settings, preserves deleted profiles, and provides Clear manual exclusions.
- Styles now live in dashboard.css for easier maintenance.

## Validation

`npm ci`, then `npm test` runs the DOM, rules, settings, routing, bridge, and background tests.
`npm run test:data` runs dependency-free tests for EDHREC categories/sorting/inclusion, preservation of stats during HTML supplementation, deck actions/current-deck context, active counts and stale-preview rejection, art lookup and land-preset migration.
`npx playwright install chromium`, then `npm run test:browser` (or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` to use an installed browser) runs desktop/mobile geometry and screenshot checks.

Latest local validation: JavaScript syntax and manifest checks, plus all dependency-free data/deck/art/land migration tests pass. An optimization agent reviewed the implementation; fixes include shared art-observer cleanup, bounded pagination, debounced search, preserved fallback statistics, short error caches, asynchronous post-add refresh and stale-preview rejection. DOM/browser suites could not run because jsdom and Playwright are not installed and dependency downloads are blocked. The new DOM fixtures cover top-cards ordering, category browsing/search, hover art, deck-preview/count refresh, destination selection, current-commander inclusion, similar cards, tag spacing, stale responses and preview placement; these fixtures remain unexecuted here. Live Firefox/Moxfield rendering and actual authenticated writes remain unverified.

## Upgrade

Export settings from the old version first as a backup. Extract this archive, open `about:debugging#/runtime/this-firefox`, and use Reload if you replaced the files in the already-loaded folder. Otherwise load this folder's manifest.json as the temporary add-on. The extension ID is unchanged. Refresh the deck page after updating. Avoid uninstalling before exporting settings, because uninstalling can clear extension storage.

## Deck settings, match explanations, and Scryfall links

- Profile selection, edited targets/conditions, and manual exclusions are remembered per deck. Existing shared profiles and exclusions supply the initial defaults; subsequent edits stay with the current deck. Settings export/import includes these deck-specific values.
- Expand a requirement, then open **Why it counts** under a card to inspect matching conditions and highlighted card text, type, tags, or mana value. Manual inclusions are identified explicitly.
- Scryfall card pages include **Open in Moxfield**, beside the existing add-to-deck button. It performs a credential-free exact-name lookup and opens the matching Moxfield card in a new tab. Lookup failures appear beside the button. Card names are sent to Moxfield only when clicked.
- Validation: all dependency-free tests pass, including new feature checks. DOM/browser suites require unavailable jsdom/Playwright dependencies; live Firefox placement and live Moxfield lookup remain unverified.

- Requirement Search: each requirement in the main panel and sidebar has a Search link opening Moxfield in a new tab. Queries use the current conditions, preserve any/every logic and negation, restrict to Commander legality, and apply commander color identity when commander data is present. Unsupported custom conditions show a disabled Search button with an explanation. These searches follow text heuristics; manual per-card inclusions/exclusions are not part of the query.


## Compact search and movable sidebar

Search is a 24px magnifying-glass icon beside each requirement, with a tooltip and accessible label. Sidebar names stay on one line so the icon does not increase row height. Drag the Requirements header up/down; crossing the page midpoint snaps the panel to the left or right edge. Position is saved across visits. Focus the header and use Up/Down (Shift for larger steps), Left/Right to snap, or Home to reset height. Resize keeps the header reachable and scrolls the list within the available height. Cancelling a drag restores the previous position.

Validation: dependency-free suites pass, including drag/snap, keyboard controls, save-on-release, cancellation, and resize checks. Live browser visual verification is still pending because jsdom and Playwright are unavailable.


Requirement search now opens Moxfield card search (/search/cards?q=...) with the generated role filters. Tooltips and accessible labels name Moxfield. The separate Scryfall-page Open in Moxfield action is unchanged.

## EDHREC fallbacks

Land requirement rows now include an E fallback link beside Moxfield search. It opens the EDHREC landbase for the combined commander color identity, or the general Lands page if commander colors are unknown. Basic and nonbasic requirements share the landbase browser.

All supported Moxfield card pages and previews keep direct Card on EDHREC, Similar cards on EDHREC, and EDHREC landbases links visible during loading or request failures. Missing or changed JSON data triggers a bounded rendered-card-page fallback. Published recommendation inclusion and deck counts are recovered when available; lift stays unavailable unless published. Recovered page data is labeled; absent statistics are never presented as zero.

Dependency-free tests cover landbase link colors, partners, unknown colors, rendered-page recovery, compact deck counts, absent lift, and empty fallback pages. Live Firefox rendering and EDHREC extraction remain unverified.


## Instants and related EDHREC information

Instant requirements now have an E fallback link to EDHREC's Most Played Instants page, beside the color-filtered Moxfield search. Custom rules requiring the Instant type also receive the link.

Moxfield card information panels show Popular commanders and Synergistic cards, with card art, links, and published inclusion/deck counts or synergy percentages when available. Commander lists remain separate from ordinary recommendations. Synergy percentages are labeled separately from lift and never imply a confirmed combo. Lists start with four entries and offer Show more.

Similar cards load independently even when the main EDHREC card request fails. Rendered-page fallback can recover popular commanders as well as recommendation statistics. Missing information is stated explicitly. Dependency-free tests pass; live Firefox rendering and current endpoint compatibility remain unverified.


## Expanded EDHREC search and printings (1.10.0)

- Card Explorer searches names, rules text, card types, category tags, keywords, and loaded set details. Filter by type, requirement preset, tag, maximum mana value, maximum USD price, or commander color identity. Sort by inclusion, lift, deck count, name, synergy, mana value, price, or tag.
- Use **Load card details (next 48)** to enrich the current category from Scryfall. Repeat for subsequent batches; failed details can be retried after the remaining cards. Unknown values do not pass active detail-dependent filters. Detail loading stops scheduling new requests when its dialog closes. Art and details share cached requests and the same rate-limited queue.
- **Condense duplicate cards** groups recommendation aliases by Oracle identity when known, or normalized name otherwise. Matching duplicate counts are displayed; deck statistics are not added together.
- Every recommendation and art-detail dialog offers **Printings** / **Browse printings**. Printings load from Scryfall in pages, with explicit Load more. Search by name, printed name, set, collector number, or printing tag. Sort loaded editions by newest, Secret Lair first, set, price, or tag.
- **Secret Lair only** performs a separate Scryfall search for SLD, SLX, SLC, and SLP editions, so matching variants do not depend on loading every ordinary printing first.
- **Condense repeated artwork** groups loaded editions sharing Oracle identity, illustration, printed name, and frame treatment. Expand each group to inspect individual editions. Different artwork and renamed treatments remain separate. Unknown illustration IDs remain separate.
- Tags come from EDHREC categories, Scryfall keywords, frame effects, and promo types; Secret Lair is also a printing tag. These are published classifications, not automatically invented strategy tags.
- Use this printing changes the existing entry in the open owned deck; ordinary add-to-deck continues to use the account preferred printing. Prices are nullable USD estimates for the loaded edition.
- New read-only Scryfall requests send only card names and printing filters. They do not send deck contents or credentials. Requests are coalesced, cached, and serialized at no more than two per second.

Validation: dependency-free suites and syntax/manifest checks pass, including filters, Oracle identity condensation, repeated-art grouping, Secret Lair filters/sorting, safe URLs, printing pagination, caching, and request coalescing. The offline dependency cache lacks jsdom/Playwright. A reusable mocked-service browser fixture is available at tests/browser-fixture.cjs; headless Edge could not run it because its graphics process failed to initialize. Live Firefox layout, Scryfall responses, and authenticated deck additions remain unverified.

## EDHREC preview/menu recovery (1.10.1)

Card previews request the card endpoint first; current-commander statistics still use the commander endpoint. Cache entries distinguish these contexts. A JSON 403 no longer stops before the public EDHREC page fallback. The fallback can read embedded JSON without executing scripts, then supplement published statistics from rendered content. Similar-card requests independently try their dedicated public page when JSON fails. Redirects to unrelated pages are rejected so ordinary recommendations are not mislabeled as similar cards. HTTP 429 stops further fallback requests.

When both EDHREC representations remain unavailable, the panel keeps direct browsing links and shows card details explicitly labeled as Scryfall data. The EDHREC menu also offers useful direct links/card details after a failed request. Similar-card errors retain a direct link and Retry similar cards. Explicit Retry bypasses short-lived failure caches; successful data remains cached. No EDHREC statistics or similarities are invented.

Regression checks cover card-first lookup, JSON 403 with public-page recovery, embedded JSON, blocked-page handling, similar fallback/coalescing, fresh retries, and rate-limit stopping. All dependency-free suites pass. Live EDHREC access and Firefox rendering remain unverified; external service access restrictions may still require browsing EDHREC directly.


## Code review (1.10.2)

See SECURITY_REVIEW.md for fixed findings, regression coverage, and remaining trust boundaries. This build hardens settings imports and regex handling, prevents late deck writes after timeout, reports uncertain write outcomes, fixes runtime-message interference and stale commander context, validates metadata list shapes, and removes the unused activeTab permission. All changes for this review are scoped to v1.9. Live browser/authenticated-write verification and dependency advisory scanning remain outstanding.
