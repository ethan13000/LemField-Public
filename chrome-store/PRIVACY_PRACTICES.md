# Chrome Web Store privacy practices

Prepared from the release code. Review these against the actual dashboard wording before certifying.

## Single purpose

Help users build, review and prepare print sheets for their Moxfield decks by combining live deck requirements, relevant card discovery and deck printing tools.

## Permission justifications

storage: Saves local profiles, feature choices, print preferences and sync status. If explicitly enabled in the popup, Chrome storage sync transfers supported printing selections and token quantities between the user's Chrome installations.

offscreen: Creates a bundled offscreen document solely to parse public EDHREC fallback HTML with DOMParser because extension service workers have no DOM. The fetched HTML is parsed as data; its scripts are not executed. No audio, screen capture or clipboard use is involved.

Host access:

- https://moxfield.com/* and https://www.moxfield.com/*: display the companion UI, read the relevant deck/card context and communicate with the existing signed-in Moxfield page for explicitly requested deck actions.
- https://api.moxfield.com/*, https://api2.moxfield.com/*: read deck/card information and perform user-requested card/edition/quantity changes through Moxfield's APIs.
- https://json.edhrec.com/* and https://edhrec.com/*: load recommendations, card/commander statistics and public HTML fallbacks.
- https://api.scryfall.com/*: retrieve card details, artwork references, printings and tokens, and run card/role queries.
- Content-script matches on https://scryfall.com/card/* and https://www.scryfall.com/card/*: add the Moxfield action to Scryfall card detail pages. These are site access too, even though they are declared in content_scripts instead of host_permissions.

No all-sites, cookies, webRequest, browsing-history, debugger, activeTab or tabs permission is requested. Tab query/create/sendMessage operations use available APIs without reading unrelated tab URLs.

## Remote code

Select No. Runtime JavaScript is bundled. Network responses are JSON, card images and non-executed HTML parsed for card data. No remote scripts, eval or new Function are needed.

## Data types to disclose

Do not select a blanket "no user data" claim. Chrome requires disclosure for local processing as well as transmission.

- Authentication information: the existing Moxfield authorization header is used in memory for signed-in Moxfield operations. It is not stored or sent to the card-data providers.
- Web history: relevant Moxfield deck URLs/IDs and supported page context, limited to deckbuilding features. No unrelated browsing history is read.
- User activity: card searches, selected printings, quantities and requested deck actions, including opt-in sync records and their conflict-resolution device identifier. No analytics tracking is implemented.
- Website content: deck lists/card data, relevant page content and locally uploaded artwork for print sheets. Artwork stays local.

The implementation does not intentionally collect personal contact details, financial/payment data, health data, location or personal communications. Ordinary network IP metadata is received by the providers as described in the policy.

Certify the dashboard's limited-use statements only after reviewing that they match the release: data is not sold, used outside the stated functionality, or used for creditworthiness/lending. If future code changes introduce another use, update the disclosures before publishing that change.

## Policy URL

Host PRIVACY.md or the packaged privacy.html on a publicly accessible HTTPS page under the publisher's control. Enter that URL in the dashboard and verify it works while signed out. The bundled page remains accessible from the popup, but is not a public policy URL.

References checked November 14, 2026:

- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
