# LemField privacy policy

Effective November 14, 2026. Applies to the Chrome release, version 1.0.1.

LemField is an independent Moxfield deckbuilding companion. The developer operates no extension analytics, advertising or data-collection server.

## Information used for the extension's features

Moxfield receives deck identifiers/URLs, deck content, card names, selected editions, quantities and requested deck changes. Signed-in features use your existing Moxfield authorization header observed inside its page, only with Moxfield's API. Authentication values are handled in memory for these operations and are not saved in extension storage, exported or sent to EDHREC or Scryfall. The extension never asks for your password.

EDHREC receives card and commander identifiers derived from your active deck or selected card to retrieve recommendations and card information. Recommendation requests may run automatically for the active deck.

Scryfall receives card names, set/collector identifiers, search terms and derived role/filter queries for card metadata, artwork, printings and tokens. Images also load from EDHREC image hosts, Moxfield's asset host and Scryfall's symbol host. These providers receive ordinary network metadata, such as IP addresses and request headers, under their own policies. Requests use HTTPS.

The extension reads relevant Moxfield/Scryfall page content and deck context. It does not collect unrelated browsing history, intercept browser/search-engine searches, collect payments or personal communications, or implement advertising tracking.

## Local storage and optional synchronization

Profiles, feature switches, deck context, printing choices, token quantities and temporary status/undo records are stored in your browser. Uploaded artwork stays on this device; it is not uploaded to Moxfield, EDHREC or Scryfall.

Print-setting sync is off by default. If you choose Enable print settings sync in the popup, supported printing choices and token quantities may synchronize through Chrome storage sync. Synced records include deck IDs, card/edition information, edit timestamps and a randomly generated conflict-resolution device ID. Credentials, uploaded artwork and undo history are excluded. Chrome account/sync policies apply. Browser account sync must also be enabled; synchronization does not cross browser families.

Choose Disable print settings sync in the popup to stop future extension sync reads and writes. This does not erase records already held by your browser account. Browser account controls govern that cloud data. Local settings and JSON export/import remain available when sync is off.

JSON export is a user-initiated local download. Import reads the selected backup and may sync supported imported preferences if extension sync is enabled. PDF creation takes place locally.

## Retention and deletion

Local preferences and artwork remain until reset or removed with the extension's active installation data. Temporary caches can be discarded when the background worker restarts. Use the extension's reset controls for supported settings/artwork. Removing the extension does not delete previously downloaded exports, cloud sync records or data held by third-party services; manage those separately with the relevant provider.

Incognito use is disabled for this release. No telemetry, crash-report upload, advertising identifiers, sale of data, or use for credit decisions is implemented. Data is used only to provide the extension features described here and in its store listing.

For support or privacy questions, use the publisher's maintained contact in the official LemField Chrome Web Store listing.
