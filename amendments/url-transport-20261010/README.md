# DiscussionBridge Alpha.23 URL Transmission Amendment

Phil approved encoded URLs between components and readable presentation for
people on October 10, 2026, replying "do that" to Bridge Builder's recommendation.
This is UA01, an approved local implementation amendment to the frozen Alpha.23
specification. It is not a new frozen release or deployment approval.

## URL representation

Every v2 `Url` is an absolute ASCII HTTPS URI. International characters remain
supported: native platforms and adapters encode them before constructing the
typed payload. For example, a readable `https://example.test/café` is transmitted
as `https://example.test/caf%C3%A9`. International domain names use IDNA A-labels.
Multilingual paths remain distinct; titles, content and labels remain Unicode.

The sender preserves existing percent escapes and native URL meaning; it does
not double-encode, encode the entire URL, reorder query parameters or rename
slugs. The receiver validates and preserves accepted bytes exactly. Literal
Unicode, empty authority and malformed URLs are rejected, not silently repaired.
The 2,048-byte limit applies after encoding. An oversized address produces a
clear local error naming the affected field and this limit, without exposing
the URL. It is never silently shortened or renamed. Phil explicitly agreed to
this reporting requirement. The protocol error remains `invalid_field`.
Existing HTTPS, origin, ownership,
collision and native-alias requirements still apply.

Readers may see readable titles, labels and safe international URL presentation.
The encoded link target still reaches the same native page. Authors do not
manually encode URLs. This amendment does not rewrite existing stored identities,
receipts, replay payloads or URL ancestry, and it does not change v1.

## Contract and implementation members

[amendment.json](amendment.json) overrides only the v2 `Url` type and records the
associated sender, receiver, display and identity rules.
[url-cases.json](url-cases.json) supplies 18 accepted and 34 rejected shared
vectors. A receiver must return an accepted URL unchanged.

The isolated Ruby and JavaScript v2 validators load the unchanged frozen types
plus an integrity-checked copy of this amendment. Native source hooks and
publication wiring remain implementation work; unit validation is not
end-to-end international URL qualification.

## Immutable baseline and release boundary

Base contract commit: `d9b55809440482ea5ef563d521bb624b9ff26569`.
Base local tag: `v0.2.0-alpha.23`.

The tag, release manifest, seven approved packet members and protected Work List
remain unchanged. UA01 is maintained separately, with its implementation and
test results in the working Work List. It must be included in a subsequently
authorized immutable release identity before release qualification. No tag move,
GitHub change, installation or deployment is authorized by this amendment.
