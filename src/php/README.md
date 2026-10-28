# Native PHP V4 codec

DiscussionBridge\CmsV4\Codec takes one explicit exact schema path and verifies
SCHEMA_SHA256 before use. Byte-copy CmsCodec.php and the matching cms-schema.json
unchanged into a private native package and record CANDIDATE/ARTIFACTS descriptors.
Only this V4 namespace/pair is active; no older namespace or profile switch.
PHP >=8.1 syntax, 64-bit PHP required, no Node/mbstring/intl runtime dependency.
PHP 8.3/8.5 are the prepared offline test runtimes.

Public API: route, hasType, validate, defaults, parseJson, parseQuery, parseRequest,
validateRoute, validateResponse, decodeResponse, encodeJson, semanticIdentity,
nativeOwnershipReceiptSha256; generatedReadMore, measureToFullEnvelope,
createGeneratedExcerpt, validateGeneratedEnvelope, generatedSourceIdentity,
validateGeneratedSelection and projectGeneratedReadMoreMove.

Objects are stdClass, lists are PHP list arrays; empty {} and [] remain different.
Null and omission remain different. NoContent::VALUE represents permitted bodyless
V4-13 HTTP 204; JSON null/whitespace is not that result. Core IDs remain canonical
decimal strings. Raw strings/Unicode/control/nonblank inspection never normalize
identity bytes. Integer validity includes original exact decimal/exponent lexemes,
safe bounds and signed-zero rejection, not floating rounding.

parseRequest options: rawBody/mediaType/contentEncoding/queryString/path/method.
validateRoute options: body/query/path/method. GET body/query/method/path identities,
closed branches, request 65536, metadata response 262144, chunk response 65536 and
decoded chunk 32768 byte limits remain exact. No total From publication cap.
Response media/origin/authentication/current policy/native state remain caller-owned.
The codec does not implement HTTP, a publisher engine, retries or native proofs.

Generated excerpt helpers use exact UTF8 prefix boundary/hash, authoritative
terminal marker/link, complete-source evidence and deterministic full projection.
validateGeneratedSelection accepts trusted receiver CURRENT stored input only for
same-edition context; never expose that argument as caller wire authority. Projection
is value-local, not a move/lease/proof/transaction execution grant.

ValidationException has validationCode/path/httpStatus without untrusted values in
message text. UnsupportedBehaviorException is a local implementation limitation,
not a new wire error. Explicit unsupported processing: 32-bit PHP, IDNA/Unicode or
ACE host conversion, noncanonical numeric/IPv4 URL normalization, backslash WHATWG
URL processing, JSON depth above 512, object keys beginning NUL, and generic
Unicode-key canonicalization outside declared ASCII CMS field names. Unsupported
cases are not silently accepted with weaker grammar. Native owners must expose
specific attention rather than assume full portable or URL standard equivalence.

Native ownership receipt format db-native-ownership-1 remains a local durable
length-prefixed field-order fingerprint, not API v1, authentication or secret.
Normal future V4 upgrades preserve that usable state or explicitly migrate it,
including encryption context and pending exact bytes; no blind version renaming.
