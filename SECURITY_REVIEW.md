# Code review — LemField 1.10.2

Reviewed the active Firefox extension source, authenticated page bridge, settings imports and evaluation, runtime messaging, third-party response parsing, and rendering. This is a source review with local regression tests, not a penetration test or a claim that the extension is vulnerability-free.

## Fixed findings

| Severity | Finding and trigger | Change |
| --- | --- | --- |
| Medium | Imported profile/rule IDs such as `__proto__` and inherited dictionary keys could break profile lookup. A pasted card using a reserved object name could cause exclusion writes to reach an inherited object. | Reject reserved IDs, use dictionaries without object prototypes, read only own override properties, and validate nested overrides and tags. Reset preserves these protections. |
| Medium | Imported or manually configured regex patterns could cause excessive main-thread backtracking. Invalid negated patterns could incorrectly match cards. | Reject common pathological constructions, backreferences, lookarounds, excessive repetitions and long patterns; bound scanned text. Reject unsafe imported rules and show an editor warning. Invalid/unsafe patterns return no match even when negated. Built-in presets remain supported. |
| Medium | A multi-page printing lookup could outlive the client's 55-second timeout and then start a deck write after the user had seen a timeout. | All preparatory requests and the write share a 45-second action deadline. The bridge refuses to begin a POST once that deadline has expired. |
| Medium | A POST returning a server error or an unreadable success response might already have changed the deck, but its error did not identify the uncertain outcome. | Network failures, aborts, 5xx responses and unreadable success responses explicitly tell the user to check the deck before retrying. No automatic write retry was added. |
| Low | An `async` runtime listener returned a Promise for unrelated message types, competing with the popup/requirements listener for responses. | Check the message type synchronously and return `undefined` for messages the deck client does not handle. |
| Low | An older deck response updated commander context before being rejected as stale. | Compare deck versions before mutating context. |
| Low | Missing commander-color data was treated as a known colorless commander in requirement searches. | Add the identity restriction only when commander colors are known. |
| Low | Malformed tag, face, or color arrays from external card metadata could throw during filtering/rendering. | Validate list shapes and ignore invalid entries. |
| Hardening | The authenticated bridge accepted non-string request IDs through coercion and allowed unbounded concurrent actions. | Require string IDs and cap pending actions at 16. |
| Hardening | `activeTab` was requested but not needed by the current implementation. | Removed it. The extension uses its existing Moxfield host permissions and registered content scripts. |

Settings imports are also limited to 5 MB, and non-finite numeric targets are normalized to finite values.

## Remaining trust boundaries and limitations

- The authenticated bridge runs in Moxfield's page world. Origin and `event.source` checks reject other origins/frames, but scripts already running in the same Moxfield page can observe or forge page messages. The channel does not authenticate the extension as the exclusive caller. Protecting against a compromised Moxfield origin would require a different privileged command transport. Ownership checks and server authorization remain essential.
- Completed request IDs provide bounded idempotency, not permanent replay protection. The cache holds 100 completed requests. Deck writes are not automatically retried, and uncertain outcomes must be checked on Moxfield.
- Regex validation is conservative and heuristic. It blocks known dangerous forms but is not a formal guarantee against every possible slow expression. A worker with a hard execution timeout would provide stronger isolation for arbitrary custom regex.
- Live Firefox rendering, authenticated deck writes, and changes in Moxfield's undocumented APIs were not verified in this environment. EDHREC can still block extension requests; direct browsing fallbacks remain available.
- Dependency advisory scanning was not completed: development dependencies are not installed, and the offline package cache lacks jsdom/Playwright. Those test dependencies are not bundled in the release ZIP.

## Rendering and network observations

The reviewed production scripts use `textContent` and DOM nodes for card names, tags, rules text and errors; no `innerHTML`, `eval`, or `new Function` sink was found. Published EDHREC/Scryfall card URLs and image URLs are checked against service/CDN allowlists. External links use `noopener noreferrer`. Third-party requests omit credentials. Authenticated deck requests use the fixed Moxfield API origin, validate destinations against the user's owned deck list, and require an exact card/printing match. Session authorization is not returned in page replies or forwarded to EDHREC/Scryfall.

## Verification

All dependency-free suites pass. Added/extended regressions cover reserved dictionary keys, inherited overrides, finite targets, unsafe and negated regex, built-in pattern compatibility, unknown colors, malformed metadata, unclaimed runtime messages, stale commander context, shared action deadlines, no late POST, 5xx/JSON uncertainty, and existing token isolation/owned-deck validation. Syntax and manifest-script checks also pass. Browser/DOM suites remain unavailable for the reasons above.
