# Native PHP V4 codec

DiscussionBridge\CmsV4\Codec takes one explicit exact schema path and verifies
SCHEMA_SHA256 before use. Byte-copy CmsCodec.php, the matching cms-schema.json,
and the COMPLETE adjacent idna/ directory unchanged into a private native package;
record CANDIDATE/ARTIFACTS descriptors. The codec checks the pinned dependency
manifest and every runtime member before loading. A missing, changed or mismatched
bundle fails closed; no ambient library or network fallback exists.
Only this V4 namespace/artifact set is active; no older namespace or profile switch.
PHP >=8.1, 64-bit PHP required; no Node, runtime Composer or mandatory mbstring,
intl or iconv extension. CI exercises PHP8.1/8.3/8.5. The IDNA runtime has private
Rowbot IDNA/Punycode and Symfony pure-PHP normalization/UTF8 dependencies, with all
upstream MIT licenses retained. It does not install public polyfill functions or
an ambient Normalizer alias. See idna/DEPENDENCIES.json for exact pins, original
source hashes, build inputs, transformations and shipped member hashes.

The authoritative private bootstrap does not register Composer's global engine
or publish private package metadata through a host Composer installation.
Repeated unrelated class queries remain harmless. Identical byte-copied private
bundles share one verified bootstrap; a different private runtime already loaded
under the same namespace is refused rather than mixed. Tests use pinned real
Composer 2.8.1 class bodies (with their license), synthetic host package data via
the real API, and absent/before/after/cold-host load orders. No runtime Composer
installation is needed for these checks or by the codec's consumers.

Public API: route, hasType, validate, defaults, parseJson, parseQuery, parseRequest,
validateRoute, validateResponse, decodeResponse, encodeJson, semanticIdentity,
nativeOwnershipReceiptSha256, urlAuthority; generatedReadMore, measureToFullEnvelope,
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
not a new wire error. Domain hosts use the pinned db-url-uts46-17-1 Unicode17.0.0
non-transitional UTS46 policy, with Bidi/Joiner checks and invalid-ACE rejection;
numeric IPv4 hosts then use WHATWG radix/part/range validation. Unicode/ACE and
percent-decoded host conversions are validation-local: the original URL bytes
remain unchanged. Forbidden raw backslashes produce invalid_field, like JS.
This is typed local URL validation, not an HTTP/DNS/SSRF authorization boundary.
urlAuthority returns only rawHost/asciiHost/effectivePort. The exact raw host is
retained; valid IP spellings are not silently reserialized. These facts are not
replacement URLs or a stored-key migration instruction. The receiver must test
its actual origin/lock/collision/reservation paths separately.
Explicit unsupported processing: 32-bit PHP, JSON depth above 512, object keys beginning NUL, and generic
Unicode-key canonicalization outside declared ASCII CMS field names. Unsupported
cases are not silently accepted with weaker grammar. Native owners must expose
specific attention rather than assume full portable or URL standard equivalence.

Dependency maintenance is an explicit development action, not normal generation:
install the two locked Composer projects under php-dependencies/ and tools/php-idna/
with plugins/scripts disabled. Set DISCUSSIONBRIDGE_PHP_BUILD_BINARY and
DISCUSSIONBRIDGE_COMPOSER_PHAR explicitly, then run node scripts/build-php-idna.mjs.
The separately locked PHP-Scoper needs development PHP>=8.2, not customer PHP.
Its fixed private scope and narrow bootstrap bindings do not introduce a new IDNA
policy. The declared source-hashed ContextJ method replacement in
implementation/php-contextj.php.in corrects upstream occurrence-offset handling:
every joiner is checked at its own UTF8 byte position, including virama paths.
It is applied by the maintainer refresh and recorded in the dependency manifest,
not hand-edited into generated vendor output. Before a deliberate dependency/data refresh, import hash-pinned
normalization inputs with node scripts/import-normalization-inputs.mjs --download.
The builder runs unchanged upstream Symfony Compiler::unicodeMaps in an isolated
staging directory against Unicode17 inputs and replaces only six private data
maps; it never runs upstream's network-fetching update script. Both MIT and Unicode
licenses are retained. Normal generate --check and candidate packaging verify the committed
bundle OFFLINE. Changes require the same explicit authority, tests, exact-candidate
review and consumer package qualification as any shared runtime change.

Native ownership receipt format db-native-ownership-1 remains a local durable
length-prefixed field-order fingerprint, not API v1, authentication or secret.
Normal future V4 upgrades preserve that usable state or explicitly migrate it,
including encryption context and pending exact bytes; no blind version renaming.
