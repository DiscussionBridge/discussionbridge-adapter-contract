import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ProtocolError,
  canonicalize,
  parseProtocolJson,
  validateAcknowledgement,
  validateAcknowledgementExchange,
  validateAcknowledgementResponse,
  validateAcknowledgementIdentity,
  validateAuthenticationHeaders,
  validateCatalogSegment,
  validateCatalogSegmentText,
  validateCatalogCursor,
  validateCatalogUpdate,
  validateCatalogUpdateResponse,
  validateCatalogUpdateText,
  validateClaimRequest,
  validateClaimResponse,
  validateClaimResponseText,
  validateChunk,
  validateChunkSet,
  validateConnectionCapability,
  validateConnectionCapabilityText,
  validateContractHeader,
  validateCorrelationExchange,
  validateCursorSnapshot,
  validateCutoverManifest,
  validateCutoverRehearsal,
  validateDestinationCollision,
  validateDirection,
  validateEntitlementTime,
  validateErrorResponse,
  validateErrorResponseText,
  validateFailure,
  validateForumClone,
  validateIdentity,
  validateInventory,
  validateLeaseRenewal,
  validateLeaseTime,
  validateNetwork,
  validateNetworkRoute,
  validateOperatorEntitlement,
  validateOperatorAudit,
  validatePresentationMode,
  validateReplay,
  validateRecordIndex,
  validateRecordShow,
  validateRepositoryIdentity,
  validateResolvedPolicy,
  validateResolveRecord,
  validateResolveRequestText,
  validateResolveResponse,
  validateRetiredUrl,
  validateRetryTrace,
  validateRevisionTransition,
  validateRevocationDetail,
  validateRevocationCursor,
  validateRevocationIndex,
  validateRenewal,
  validateScope,
  validateSourceDetail,
  validateSourceDetailText,
  validateStageTransition,
  validateUrlProof,
  validateUrlProofResponse,
  validateWork,
  validateWorkText,
} from "./protocol-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = async (relative) => parseProtocolJson(await readFile(path.join(root, relative), "utf8"));
const contract = await load("contract.json");
const operator = await load("operator-service-contract.json");
const packageMetadata = await load("package.json");
const rfc8785Example = await load("tests/rfc8785-example.json");
const rfc8785Expected = (await readFile(path.join(root, "tests", "rfc8785-example.canonical.txt"), "utf8")).trimEnd();
assert.equal(canonicalize(rfc8785Example), rfc8785Expected, "RFC 8785 Section 3.2.2/3.2.3 example must canonicalize exactly");
const positiveDirectory = path.join(root, "fixtures");
const negativeDirectory = path.join(positiveDirectory, "invalid");
const positiveNames = (await readdir(positiveDirectory)).filter((name) => name.endsWith(".json")).sort();
const negativeNames = (await readdir(negativeDirectory)).filter((name) => name.endsWith(".json")).sort();
const fixtures = new Map();
const fixtureTexts = new Map();
for (const name of positiveNames) {
  const text = await readFile(path.join(root, "fixtures", name), "utf8");
  fixtureTexts.set(name, text);
  fixtures.set(name, parseProtocolJson(text));
}
const invalid = new Map();
for (const name of negativeNames) invalid.set(name, await load(`fixtures/invalid/${name}`));

assert.equal(contract.contract, "discussionbridge-adapter");
assert.equal(contract.version, "0.2.0-alpha.22");
assert.deepEqual(contract.configuration.presentation_modes, ["simple", "full", "interactive"]);
assert.equal(contract.publication_work.initial_attempts + contract.publication_work.maximum_automatic_retries, contract.publication_work.maximum_total_attempts);
assert.equal(contract.publication_work.retry_backoff_seconds.length, contract.publication_work.maximum_automatic_retries);
assert.equal(operator.entitlement.canonicalization, "RFC 8785 JCS");
assert.deepEqual(
  [...new Set([...contract.records.destination_binding_required_fields, ...contract.records.destination_binding_synchronization_fields, ...contract.records.destination_binding_event_timestamp_fields])].sort(),
  [...contract.records.destination_binding_fields].sort(),
  "destination binding required/conditional fields must exactly cover the declared field vocabulary",
);
validateRepositoryIdentity(packageMetadata, contract, operator);

const trustVector = fixtures.get("operator-entitlement-test-vector.json");
const trust = { [`${trustVector.issuer_id}:${trustVector.key_id}`]: trustVector.public_key_base64url };
const approvalKeyPair = generateKeyPairSync("ed25519");
const approvalEntitlement = structuredClone(fixtures.get("operator-entitlement.json"));
approvalEntitlement.key_id = "alpha22-approval-test";
approvalEntitlement.scopes = ["apply_customer_approved_upgrade"];
delete approvalEntitlement.signature;
approvalEntitlement.signature = sign(null, Buffer.from(`${operator.entitlement.signing_domain}${canonicalize(approvalEntitlement)}`, "utf8"), approvalKeyPair.privateKey).toString("base64url");
const approvalTrust = { [`${approvalEntitlement.issuer_id}:${approvalEntitlement.key_id}`]: approvalKeyPair.publicKey.export({ format: "jwk" }).x };
const resignApprovalEntitlement = (value) => {
  const signed = structuredClone(value);
  delete signed.signature;
  signed.signature = sign(null, Buffer.from(`${operator.entitlement.signing_domain}${canonicalize(signed)}`, "utf8"), approvalKeyPair.privateKey).toString("base64url");
  return signed;
};
const signEntitlementWithUncheckedProviderName = (value) => {
  const unsigned = structuredClone(value);
  delete unsigned.signature;
  const placeholder = "DiscussionBridge Unicode placeholder";
  const safe = { ...unsigned, provider_name: placeholder };
  const encodedPlaceholder = JSON.stringify(placeholder);
  const safeCanonical = canonicalize(safe);
  assert.equal(safeCanonical.split(encodedPlaceholder).length, 2, "unchecked provider-name signing placeholder must occur exactly once");
  const uncheckedCanonical = safeCanonical.replace(encodedPlaceholder, JSON.stringify(unsigned.provider_name));
  return {
    ...unsigned,
    signature: sign(null, Buffer.from(`${operator.entitlement.signing_domain}${uncheckedCanonical}`, "utf8"), approvalKeyPair.privateKey).toString("base64url"),
  };
};
const claimedWorkFixture = fixtures.get("publication-work-claim.json");
const renewalContext = {
  work: claimedWorkFixture.publication_work[0],
  state: "leased",
  claimed_at: claimedWorkFixture.claimed_at,
  request_received_at: "2026-09-27T18:34:00Z",
  current_total_lease_seconds: 300,
};
const acknowledgementContext = { received_at: "2026-09-27T18:31:00Z", claimed_at: claimedWorkFixture.claimed_at, destination_mode: "static" };
const approvedOperationContext = {
  forumId: approvalEntitlement.forum_id,
  at: "2026-09-28T00:00:00Z",
  state: "active",
  scope: "apply_customer_approved_upgrade",
  mutation: true,
  operationSha256: "5".repeat(64),
  proposalId: "proposal:upgrade:1",
  customerApproval: {
    providerId: approvalEntitlement.provider_id,
    forumId: approvalEntitlement.forum_id,
    scope: "apply_customer_approved_upgrade",
    operationSha256: "5".repeat(64),
    proposalId: "proposal:upgrade:1",
    expiresAt: "2026-09-29T00:00:00Z",
  },
};
validateOperatorEntitlement(approvalEntitlement, operator, approvalTrust, approvedOperationContext);

const positiveHandlers = {
  "authentication-headers.json": (value) => validateAuthenticationHeaders(value, contract),
  "connection-capability.json": (_value, text) => validateConnectionCapabilityText(text, contract),
  "connection-capability-to-discourse.json": (_value, text) => validateConnectionCapabilityText(text, contract),
  "correlation-roundtrip.json": (value) => { for (const transaction of value.transactions) { const exchange = structuredClone(transaction); delete exchange.route; validateCorrelationExchange(exchange, contract); } },
  "created-response.json": (value) => validateResolveResponse(value, contract.resolve.success_response_required_fields, contract),
  "resolved-response.json": (value) => validateResolveResponse(value, contract.resolve.success_response_required_fields, contract),
  "reconciliation-required-response.json": (value) => validateResolveResponse(value, contract.resolve.reconciliation_response_required_fields, contract),
  "rejected-response.json": (_value, text) => validateErrorResponseText(text, contract),
  "to-discourse-request.json": (value) => validateResolveRecord(value.bridge_record, contract),
  "to-discourse-excerpt-request.json": (value) => validateResolveRecord(value.bridge_record, contract),
  "to-discourse-wiki-update-request.json": (value) => {
    validateResolveRecord(value.bridge_record, contract);
    validateRevisionTransition(value.stored, value.bridge_record);
    assert.equal(value.stored.external_id, value.bridge_record.external_id);
  },
  "from-discourse-record.json": (value) => validateRecordShow(value, contract),
  "bridge-record-index.json": (value) => validateRecordIndex(value, contract),
  "source-inventory-page.json": (value) => validateInventory(value, contract),
  "source-inventory-resume-page.json": (value) => {
    assert.equal(value.request.snapshot, value.response.snapshot);
    assert.equal(value.request.correlation_id, value.response.correlation_id);
    validateInventory(value.response, contract);
  },
  "source-detail-inline.json": (_value, text) => validateSourceDetailText(text, contract),
  "source-detail-chunked.json": (_value, text) => validateSourceDetailText(text, contract),
  "network-source-detail.json": (_value, text) => validateSourceDetailText(text, contract),
  "network-spoke-source-detail.json": (_value, text) => validateSourceDetailText(text, contract),
  "source-content-chunk.json": (value) => validateChunk(value, null, contract),
  "source-revocation.json": (value) => validateRevocationDetail(value, contract),
  "source-revocation-index.json": (value) => validateRevocationIndex(value, contract),
  "revocation-restart-trace.json": (value) => {
    assert.equal(value.page_one.high_water, value.page_two.high_water);
    assert.equal(value.page_two.complete, true);
    assert.equal(value.restart.deduplicate_by, "revocation_id");
    assert.equal(value.restart.read_does_not_acknowledge, true);
  },
  "source-url-proof.json": (value) => validateUrlProofResponse(value, contract),
  "publication-work-claim-request.json": (value) => validateClaimRequest(value, contract),
  "publication-work-claim.json": (_value, text) => validateClaimResponseText(text, contract, fixtures.get("publication-work-claim-request.json")),
  "publication-work-restore.json": (_value, text) => validateClaimResponseText(text, contract),
  "publication-work-withdrawal.json": (_value, text) => validateClaimResponseText(text, contract),
  "publication-lease-renewal.json": (value) => validateRenewal(value, contract, renewalContext),
  "publication-acknowledgement-create.json": (value) => validateAcknowledgement(value, contract),
  "publication-acknowledgement-static-pending.json": (value) => {
    validateAcknowledgement(value, contract);
    validateAcknowledgementIdentity(fixtures.get("publication-work-claim.json").publication_work[0], value, "leased", acknowledgementContext);
  },
  "publication-acknowledgement-static-deployed.json": (value) => validateAcknowledgement(value, contract),
  "publication-acknowledgement.json": (value) => validateAcknowledgement(value, contract),
  "publication-acknowledgement-responses.json": (value) => {
    for (const response of Object.values(value)) validateAcknowledgementResponse(response, contract);
    assert.equal(value.synchronized.next_stage_token, fixtures.get("publication-acknowledgement-static-deployed.json").stage_token);
    assert.equal(value.deployed.next_stage_token, fixtures.get("publication-acknowledgement.json").stage_token);
    assert.equal(value.verified.terminal, true);
    assert.equal(value.dynamic.terminal, true);
  },
  "publication-dynamic-trace.json": (value) => {
    const acknowledgement = fixtures.get(value.acknowledgement);
    const response = fixtures.get("publication-acknowledgement-responses.json")[value.response_key];
    validateAcknowledgementExchange(value.work, acknowledgement, response, contract, "leased", {
      claimed_at: value.claimed_at,
      received_at: value.received_at,
      destination_mode: "dynamic",
    });
    validateCorrelationExchange({ request_header: acknowledgement.correlation_id, request_body: acknowledgement.correlation_id, response_header: response.correlation_id, response_body: response.correlation_id }, contract);
    assert.equal(response.resulting_state, value.terminal_state);
  },
  "publication-failure.json": (value) => validateFailure(value, contract),
  "publication-deployment-failure.json": (value) => validateFailure(value, contract),
  "publication-verification-failure.json": (value) => validateFailure(value, contract),
  "publication-work-retry-wait.json": (value) => {
    assert.equal(value.resulting_state, "retry_wait");
    assert.equal(value.backoff_seconds, contract.publication_work.retry_backoff_seconds[value.attempt_count - 1]);
    assert.equal(Date.parse(value.next_retry_at) - Date.parse(value.failed_at), value.backoff_seconds * 1000);
  },
  "publication-work-exhausted.json": (value) => {
    assert.equal(value.attempt_count, contract.publication_work.maximum_total_attempts);
    assert.equal(value.maximum_total_attempts, contract.publication_work.maximum_total_attempts);
    assert.equal(value.resulting_state, "operator_attention");
    assert.equal(value.next_retry_at, null);
  },
  "publication-static-trace.json": (value) => {
    const synchronized = fixtures.get(value.synchronized);
    const deployed = fixtures.get(value.deployed);
    const verified = fixtures.get(value.verified);
    const responses = fixtures.get("publication-acknowledgement-responses.json");
    const claimedWork = fixtures.get("publication-work-claim.json").publication_work[0];
    validateAcknowledgement(synchronized, contract);
    validateAcknowledgementIdentity(claimedWork, synchronized, "leased", acknowledgementContext);
    validateAcknowledgementResponse(responses.synchronized, contract, { work: claimedWork, acknowledgement: synchronized, destination_mode: "static" });
    validateCorrelationExchange({ request_header: synchronized.correlation_id, request_body: synchronized.correlation_id, response_header: responses.synchronized.correlation_id, response_body: responses.synchronized.correlation_id }, contract);
    validateStageTransition(synchronized, deployed, responses.synchronized);
    validateAcknowledgement(deployed, contract);
    validateAcknowledgementIdentity({ ...claimedWork, stage_token: responses.synchronized.next_stage_token }, deployed, "awaiting_deployment", { received_at: "2026-09-27T18:36:00Z", destination_mode: "static" });
    validateAcknowledgementResponse(responses.deployed, contract, { work: claimedWork, acknowledgement: deployed, destination_mode: "static" });
    validateCorrelationExchange({ request_header: deployed.correlation_id, request_body: deployed.correlation_id, response_header: responses.deployed.correlation_id, response_body: responses.deployed.correlation_id }, contract);
    validateStageTransition(deployed, verified, responses.deployed);
    validateAcknowledgement(verified, contract);
    validateAcknowledgementIdentity({ ...claimedWork, stage_token: responses.deployed.next_stage_token }, verified, "awaiting_verification", { received_at: "2026-09-27T18:37:00Z", destination_mode: "static" });
    validateAcknowledgementResponse(responses.verified, contract, { work: claimedWork, acknowledgement: verified, destination_mode: "static" });
    validateCorrelationExchange({ request_header: verified.correlation_id, request_body: verified.correlation_id, response_header: responses.verified.correlation_id, response_body: responses.verified.correlation_id }, contract);
    assert.deepEqual(value.interruption_recovery_states, ["awaiting_deployment", "awaiting_verification"]);
    assert.equal(value.terminal_state, "acknowledged");
  },
  "publication-retry-trace.json": (value) => {
    validateRetryTrace(value, contract);
    assert.equal(value.initial_attempt, contract.publication_work.initial_attempts);
    assert.deepEqual(value.failures.slice(0, -1).map((item) => item.backoff_seconds), contract.publication_work.retry_backoff_seconds);
    assert.equal(value.failures.at(-1).attempt_count, contract.publication_work.maximum_total_attempts);
    assert.equal(value.failures.at(-1).resulting_state, "operator_attention");
    assert.equal(value.successful_retry.resulting_state, "acknowledged");
    assert.equal(value.terminal_failure.resulting_state, "operator_attention");
    assert.equal(value.manual_retry.customer_authorized && value.manual_retry.condition_corrected, true);
    assert.equal(value.manual_retry.to_retry_generation, value.manual_retry.from_retry_generation + 1);
    assert.equal(value.manual_retry.same_work_id, true);
  },
  "revision-supersession-trace.json": (value) => {
    assert.equal(value.active.content_retained, true);
    assert.equal(value.after_active_expiry.old_state, "superseded");
    assert.equal(value.after_active_expiry.new_state, "available");
    assert.equal(value.destination_identity_unchanged, true);
  },
  "platform-catalog-segment.json": (_value, text) => validateCatalogSegmentText(text, contract),
  "platform-catalog-containers.json": (_value, text) => validateCatalogSegmentText(text, contract),
  "platform-catalog-taxonomies.json": (_value, text) => validateCatalogSegmentText(text, contract),
  "platform-catalog-terms.json": (_value, text) => validateCatalogSegmentText(text, contract),
  "platform-catalog-authors.json": (_value, text) => validateCatalogSegmentText(text, contract),
  "platform-catalog-native-limits.json": (_value, text) => validateCatalogSegmentText(text, contract),
  "platform-catalog-update.json": (value) => {
    const request = validateCatalogUpdateText(JSON.stringify(value.request), contract);
    validateCatalogUpdateResponse(value.response, request, contract);
    validateCatalogUpdate(value, contract);
  },
  "operator-entitlement.json": (value) => validateOperatorEntitlement(value, operator, trust),
  "operator-entitlement-test-vector.json": (value) => {
    assert.equal(value.signing_domain, operator.entitlement.signing_domain);
    const entitlement = structuredClone(fixtures.get("operator-entitlement.json"));
    delete entitlement.signature;
    assert.equal(value.canonical_json, canonicalize(entitlement));
  },
  "operator-enrollment-audit.json": (value) => validateOperatorAudit(value, operator),
  "operator-revocation-audit.json": (value) => validateOperatorAudit(value, operator),
  "network-operation-replay.json": (value) => {
    validateReplay(value.immutable_operation, value.immutable_operation);
    assert.equal(value.retained_result.mutated, false);
  },
  "network-route-append.json": (value) => validateNetworkRoute(value, contract),
  "network-forum-identity.json": (value) => {
    assert.match(value.forum_id, new RegExp(contract.discourse_network.forum_id_pattern));
    assert.equal(value.created_once, true);
    assert.equal(value.protected_persistent, true);
    assert.equal(value.automatic_rotation, false);
    assert.equal(value.approved_rotation.customer_approved && value.approved_rotation.audited && value.approved_rotation.peers_require_reauthorization, true);
  },
  "cutover-manifest.json": (value) => {
    validateCutoverManifest(value, contract);
    assert.notEqual(value.shared_plugin.version, contract.version);
    assert.notEqual(value.adapters[0].version, contract.version);
  },
  "cutover-rehearsal.json": (value) => {
    validateCutoverRehearsal(value, fixtures.get("cutover-manifest.json"), contract);
  },
};

assert.deepEqual(Object.keys(positiveHandlers).sort(), positiveNames, "positive fixture corpus and handlers must agree bidirectionally");

for (const name of positiveNames) {
  assert.ok(positiveHandlers[name], `positive fixture has no validator: ${name}`);
  positiveHandlers[name](fixtures.get(name), fixtureTexts.get(name));
}

const pendingRecord = structuredClone(fixtures.get("from-discourse-record.json").bridge_record);
const pendingBinding = pendingRecord.bindings[0];
pendingBinding.state = "pending";
pendingBinding.deployment_state = "pending";
pendingBinding.verification_state = "pending";
delete pendingBinding.deployed_at;
delete pendingBinding.publicly_verified_at;
validateRecordShow({ bridge_record: pendingRecord, correlation_id: "pending-binding-01" }, contract);

const preAcknowledgementRecord = structuredClone(pendingRecord);
for (const field of contract.records.destination_binding_synchronization_fields) delete preAcknowledgementRecord.bindings[0][field];
validateRecordShow({ bridge_record: preAcknowledgementRecord, correlation_id: "pre-ack-migration-01" }, contract);
for (const state of contract.records.binding_states) {
  const stateRecord = structuredClone(preAcknowledgementRecord);
  stateRecord.bindings[0].state = state;
  validateRecordShow({ bridge_record: stateRecord, correlation_id: `pre-ack-migration-${state}` }, contract);
}
const dynamicPreAcknowledgementRecord = structuredClone(preAcknowledgementRecord);
dynamicPreAcknowledgementRecord.bindings[0].deployment_state = "not_required";
dynamicPreAcknowledgementRecord.bindings[0].verification_state = "not_required";
validateRecordShow({ bridge_record: dynamicPreAcknowledgementRecord, correlation_id: "pre-ack-migration-dynamic-01" }, contract);

const entityExcerpt = structuredClone(fixtures.get("to-discourse-excerpt-request.json").bridge_record);
entityExcerpt.canonical_url = "https://publisher.example/article/?first=1&second=2";
entityExcerpt.read_more_url = entityExcerpt.canonical_url;
entityExcerpt.content_html = '<p>This is a bounded excerpt.</p><p><a href="https://publisher.example/article/?first=1&amp;second=2">Read&#32;More</a></p>';
validateResolveRecord(entityExcerpt, contract);
const namedEntityExcerpt = structuredClone(fixtures.get("to-discourse-excerpt-request.json").bridge_record);
namedEntityExcerpt.content_html = `<p>This is a bounded excerpt.</p><p><a href="${namedEntityExcerpt.canonical_url.replace(":", "&colon;")}"> Read\n More </a></p>`;
validateResolveRecord(namedEntityExcerpt, contract);
const optionalEndTagExcerpt = structuredClone(fixtures.get("to-discourse-excerpt-request.json").bridge_record);
optionalEndTagExcerpt.content_html = `<p>This is a bounded excerpt.<p><a href="${optionalEndTagExcerpt.canonical_url}">Read More</a>`;
validateResolveRecord(optionalEndTagExcerpt, contract);
const maximumDepthExcerpt = structuredClone(fixtures.get("to-discourse-excerpt-request.json").bridge_record);
maximumDepthExcerpt.content_html = `${"<div>".repeat(contract.resolve.field_rules.excerpt_html_complexity.maximum_depth)}body${"</div>".repeat(contract.resolve.field_rules.excerpt_html_complexity.maximum_depth)}<p>This is a bounded excerpt.</p><p><a href="${maximumDepthExcerpt.canonical_url}">Read More</a></p>`;
validateResolveRecord(maximumDepthExcerpt, contract);
const maximumElementsExcerpt = structuredClone(fixtures.get("to-discourse-excerpt-request.json").bridge_record);
maximumElementsExcerpt.content_html = `${"<span></span>".repeat(contract.resolve.field_rules.excerpt_html_complexity.maximum_elements - 3)}<p>This is a bounded excerpt.</p><p><a href="${maximumElementsExcerpt.canonical_url}">Read More</a></p>`;
validateResolveRecord(maximumElementsExcerpt, contract);
const resolveWithExistingTopicToken = (token) => {
  const envelope = { bridge_record: { ...structuredClone(fixtures.get("to-discourse-request.json").bridge_record), existing_topic_id: 1 } };
  const encoded = JSON.stringify(envelope).replace('"existing_topic_id":1', `"existing_topic_id":${token}`);
  return parseProtocolJson(encoded).bridge_record;
};
const adjacentLargeTopicIds = [resolveWithExistingTopicToken("9007199254740992"), resolveWithExistingTopicToken("9007199254740993")];
assert.notEqual(adjacentLargeTopicIds[0].existing_topic_id, adjacentLargeTopicIds[1].existing_topic_id);
for (const record of [
  ...adjacentLargeTopicIds,
  resolveWithExistingTopicToken("1.0000e0"),
  resolveWithExistingTopicToken("9223372036854775807"),
  resolveWithExistingTopicToken("9223372036854775807e0"),
]) validateResolveRecord(record, contract);
const originalStringRepeat = String.prototype.repeat;
try {
  String.prototype.repeat = function forbiddenIntegerExpansion(count) {
    throw new Error(`exact integer parser attempted ${count}-character expansion`);
  };
  assert.equal(parseProtocolJson('{"existing_topic_id":0e1000000}').existing_topic_id, 0n, "zero coefficient must not allocate exponent-sized text");
} finally {
  String.prototype.repeat = originalStringRepeat;
}

const fractionalRenewal = structuredClone(fixtures.get("publication-lease-renewal.json"));
fractionalRenewal.response.lease_expires_at = "2026-09-27T18:50:00.0001Z";
validateRenewal(fractionalRenewal, contract, {
  ...renewalContext,
  work: { ...renewalContext.work, lease_expires_at: "2026-09-27T18:35:00.0001Z" },
  claimed_at: "2026-09-27T18:30:00.0001Z",
});
const maximumInitialClaimRequest = { ...fixtures.get("publication-work-claim-request.json"), requested_lease_seconds: contract.publication_work.claim.maximum_requested_lease_seconds, correlation_id: "claim-boundary-01" };
const maximumInitialClaimResponse = structuredClone(fixtures.get("publication-work-claim.json"));
maximumInitialClaimResponse.claimed_at = "2026-09-27T18:30:00.0001Z";
maximumInitialClaimResponse.correlation_id = maximumInitialClaimRequest.correlation_id;
for (const work of maximumInitialClaimResponse.publication_work) {
  work.lease_expires_at = "2026-09-27T19:30:00.0001Z";
  work.correlation_id = maximumInitialClaimRequest.correlation_id;
}
validateClaimResponse(maximumInitialClaimResponse, contract, maximumInitialClaimRequest);
const defaultInitialClaimRequest = structuredClone(fixtures.get("publication-work-claim-request.json"));
delete defaultInitialClaimRequest.requested_lease_seconds;
validateClaimResponse(fixtures.get("publication-work-claim.json"), contract, defaultInitialClaimRequest);
const maximumTerminalTrace = structuredClone(fixtures.get("publication-retry-trace.json"));
maximumTerminalTrace.terminal_failure.attempt_count = contract.publication_work.maximum_total_attempts;
validateRetryTrace(maximumTerminalTrace, contract);

function resolveEnvelopeAtSize(targetBytes) {
  const value = structuredClone(fixtures.get("to-discourse-request.json").bridge_record);
  value.source_authors = Array.from({ length: contract.resolve.field_rules.source_authors_maximum_items }, (_, index) => ({
    source_author_id: `author-${index}-${"i".repeat(220)}`,
    source_author_name: `Author ${index} ${"n".repeat(160)}`,
    source_author_url: `https://example.com/${index}/${"u".repeat(1900)}`,
  }));
  value.content_html = "<p></p>";
  value.source_content_bytes = Buffer.byteLength(value.content_html);
  value.source_content_sha256 = createHash("sha256").update(value.content_html).digest("hex");
  let payload = "";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const delta = targetBytes - Buffer.byteLength(JSON.stringify({ bridge_record: value }));
    if (delta === 0) break;
    assert.ok(payload.length + delta >= 0 && payload.length + delta + 7 <= contract.resolve.field_rules.content_html_maximum_bytes);
    payload = delta > 0 ? `${payload}${"x".repeat(delta)}` : payload.slice(0, delta);
    value.content_html = `<p>${payload}</p>`;
    value.source_content_bytes = Buffer.byteLength(value.content_html);
    value.source_content_sha256 = createHash("sha256").update(value.content_html).digest("hex");
  }
  assert.equal(Buffer.byteLength(JSON.stringify({ bridge_record: value })), targetBytes);
  return value;
}
validateResolveRecord(resolveEnvelopeAtSize(contract.resolve.maximum_json_bytes), contract);
const resolveWireAtLimit = JSON.stringify({ bridge_record: resolveEnvelopeAtSize(contract.resolve.maximum_json_bytes) });
validateResolveRequestText(resolveWireAtLimit, contract);
assert.throws(
  () => validateResolveRequestText(`${resolveWireAtLimit} `, contract),
  (error) => error instanceof ProtocolError && error.code === "request_too_large",
  "raw resolve request bytes must be checked before JSON parsing",
);
const escapedWireRecord = structuredClone(fixtures.get("to-discourse-request.json").bridge_record);
const escapedContent = `<p>${"x".repeat(15000)}</p>`;
escapedWireRecord.content_html = escapedContent;
escapedWireRecord.source_content_bytes = Buffer.byteLength(escapedContent);
escapedWireRecord.source_content_sha256 = createHash("sha256").update(escapedContent).digest("hex");
const ordinaryEscapedWire = JSON.stringify({ bridge_record: escapedWireRecord });
const unicodeEscapedWire = ordinaryEscapedWire.replace("x".repeat(15000), "\\u0078".repeat(15000));
assert.ok(Buffer.byteLength(ordinaryEscapedWire) < contract.resolve.maximum_json_bytes);
assert.ok(Buffer.byteLength(unicodeEscapedWire) > contract.resolve.maximum_json_bytes);
assert.throws(
  () => validateResolveRequestText(unicodeEscapedWire, contract),
  (error) => error instanceof ProtocolError && error.code === "request_too_large",
  "escape-equivalent oversized resolve request must fail on original wire bytes",
);

const restrictedCapability = structuredClone(fixtures.get("connection-capability.json"));
restrictedCapability.allowed_presentation_modes = ["interactive"];
validateConnectionCapability(restrictedCapability, contract);

function jsonTextAtSize(value, targetBytes) {
  const text = JSON.stringify(value);
  assert.ok(Buffer.byteLength(text) <= targetBytes, "fixture must fit its aggregate JSON ceiling");
  return `${text}${" ".repeat(targetBytes - Buffer.byteLength(text))}`;
}

function catalogRequestTextAtSize(targetBytes, placement = "inside") {
  const requestText = JSON.stringify(fixtures.get("platform-catalog-update.json").request);
  assert.ok(Buffer.byteLength(requestText) <= targetBytes, "catalog request fixture must fit its raw JSON ceiling");
  const padding = " ".repeat(targetBytes - Buffer.byteLength(requestText));
  if (placement === "leading") return `${padding}${requestText}`;
  if (placement === "trailing") return `${requestText}${padding}`;
  return `${requestText.slice(0, -1)}${padding}}`;
}

function fullyPopulatedCatalogUpdate() {
  const value = structuredClone(fixtures.get("platform-catalog-update.json"));
  const identifier = (prefix, index) => `${prefix}:${index}:`.padEnd(contract.common.opaque_identifier_maximum_bytes, prefix[0]);
  value.request.segments = [
    {
      segment_type: "authors",
      items: Array.from({ length: contract.platform_catalog.maximum_items_per_segment }, (_, index) => ({
        id: identifier("author", index),
        name: `Author ${index}`.padEnd(contract.common.descriptive_name_maximum_bytes, "a"),
        available: true,
      })),
    },
    {
      segment_type: "containers",
      items: Array.from({ length: contract.platform_catalog.maximum_items_per_segment }, (_, index) => ({
        id: identifier("container", index),
        name: `Container ${index}`.padEnd(contract.common.descriptive_name_maximum_bytes, "c"),
        kind: `kind-${index}`.padEnd(contract.platform_catalog.container_kind_maximum_bytes, "k"),
        available: true,
      })),
    },
  ];
  value.response.accepted_segments = ["authors", "containers"];
  assert.ok(Buffer.byteLength(JSON.stringify(value.request)) > contract.platform_catalog.maximum_json_bytes, "catalog aggregate control must exceed maximum_json_bytes with individually valid fields");
  return value;
}

const maximumLaneCapability = structuredClone(fixtures.get("connection-capability.json"));
maximumLaneCapability.lanes = Array.from({ length: contract.connection_capability.lanes_maximum_items }, (_, index) => `lane-${index}`);
validateConnectionCapability(maximumLaneCapability, contract);
const maximumPolicyCapability = structuredClone(fixtures.get("connection-capability.json"));
maximumPolicyCapability.destination_policies = Array.from({ length: contract.connection_capability.destination_policies_maximum_items }, (_, index) => ({
  ...structuredClone(maximumPolicyCapability.destination_policies[0]),
  destination_policy_id: `policy:${index}`,
}));
validateConnectionCapability(maximumPolicyCapability, contract);
const maximumMappingCapability = structuredClone(fixtures.get("connection-capability.json"));
maximumMappingCapability.destination_policies[0].taxonomy_mapping.items = Array.from(
  { length: contract.connection_capability.destination_policy_field_rules.mapping_items_maximum_items },
  (_, index) => ({ source: `s${index}`, destination: "d" }),
);
validateConnectionCapability(maximumMappingCapability, contract);
const maximumAuthorMappingCapability = structuredClone(fixtures.get("connection-capability.json"));
maximumAuthorMappingCapability.destination_policies[0].author_mapping.items = Array.from(
  { length: contract.connection_capability.destination_policy_field_rules.mapping_items_maximum_items },
  (_, index) => ({ source: `s${index}`, destination: "d" }),
);
validateConnectionCapability(maximumAuthorMappingCapability, contract);
validateConnectionCapabilityText(jsonTextAtSize(fixtures.get("connection-capability.json"), contract.connection_capability.maximum_json_bytes), contract);

const maximumSourceDetail = structuredClone(fixtures.get("source-detail-inline.json"));
maximumSourceDetail.categories = Array.from({ length: contract.source_publication.detail.categories_maximum_items }, (_, index) => ({ source_category_id: `c${index}`, source_category_name: `Category ${index}`, source_parent_category_id: null }));
maximumSourceDetail.tags = Array.from({ length: contract.source_publication.detail.tags_maximum_items }, (_, index) => ({ source_tag_id: `t${index}`, source_tag_name: `Tag ${index}` }));
validateSourceDetail(maximumSourceDetail, contract);
validateSourceDetailText(jsonTextAtSize(fixtures.get("source-detail-inline.json"), contract.source_publication.detail.maximum_json_bytes), contract);

const maximumWork = structuredClone(fixtures.get("publication-work-claim.json").publication_work[0]);
maximumWork.resolved_taxonomy = Array.from({ length: contract.publication_work.resolved_mapping_rules.taxonomy_maximum_items }, (_, index) => ({ source_id: `s${index}`, destination_id: "d" }));
validateWork(maximumWork, contract);
validateWorkText(jsonTextAtSize(fixtures.get("publication-work-claim.json").publication_work[0], contract.publication_work.maximum_json_bytes), contract);
const maximumCatalogAuthor = structuredClone(fixtures.get("platform-catalog-authors.json"));
maximumCatalogAuthor.catalog_revision = "r".repeat(contract.common.opaque_identifier_maximum_bytes);
maximumCatalogAuthor.items[0].id = "i".repeat(contract.common.opaque_identifier_maximum_bytes);
maximumCatalogAuthor.items[0].name = "n".repeat(contract.common.descriptive_name_maximum_bytes);
validateCatalogSegment(maximumCatalogAuthor, contract);
const maximumCatalogContainer = structuredClone(fixtures.get("platform-catalog-containers.json"));
maximumCatalogContainer.items[0].kind = "k".repeat(contract.platform_catalog.container_kind_maximum_bytes);
validateCatalogSegment(maximumCatalogContainer, contract);
const maximumCatalogTerm = structuredClone(fixtures.get("platform-catalog-terms.json"));
maximumCatalogTerm.items[0].taxonomy_id = "t".repeat(contract.common.opaque_identifier_maximum_bytes);
maximumCatalogTerm.items[0].parent_id = "p".repeat(contract.common.opaque_identifier_maximum_bytes);
validateCatalogSegment(maximumCatalogTerm, contract);
const maximumCatalogUpdate = structuredClone(fixtures.get("platform-catalog-update.json"));
maximumCatalogUpdate.request.base_catalog_revision = "b".repeat(contract.common.opaque_identifier_maximum_bytes);
maximumCatalogUpdate.response.catalog_revision = "r".repeat(contract.common.opaque_identifier_maximum_bytes);
validateCatalogUpdate(maximumCatalogUpdate, contract);
validateCatalogSegmentText(jsonTextAtSize(fixtures.get("platform-catalog-authors.json"), contract.platform_catalog.maximum_json_bytes), contract);
validateCatalogUpdateText(catalogRequestTextAtSize(contract.platform_catalog.maximum_json_bytes), contract);
validateCatalogUpdateText(catalogRequestTextAtSize(contract.platform_catalog.maximum_json_bytes, "leading"), contract);
validateCatalogUpdateText(catalogRequestTextAtSize(contract.platform_catalog.maximum_json_bytes, "trailing"), contract);
validateErrorResponseText(jsonTextAtSize(fixtures.get("rejected-response.json"), contract.error_responses.maximum_json_bytes), contract);
const validSplitUtf8Content = Buffer.from("A😀B", "utf8");
const validSplitUtf8Parts = [validSplitUtf8Content.subarray(0, 3), validSplitUtf8Content.subarray(3)];
const validSplitUtf8Descriptor = {
  source_revision: "revision:valid-split-utf8",
  byte_length: validSplitUtf8Content.length,
  sha256: createHash("sha256").update(validSplitUtf8Content).digest("hex"),
  chunk_count: validSplitUtf8Parts.length,
};
const validSplitUtf8Chunks = validSplitUtf8Parts.map((content, index) => ({
  source_revision: validSplitUtf8Descriptor.source_revision,
  chunk: index + 1,
  chunk_count: validSplitUtf8Descriptor.chunk_count,
  decoded_bytes: content.length,
  chunk_sha256: createHash("sha256").update(content).digest("hex"),
  content_base64: content.toString("base64"),
  correlation_id: `valid-split-utf8-${index + 1}`,
})).reverse();
validateChunkSet(validSplitUtf8Descriptor, validSplitUtf8Chunks, contract);
const validSupplementaryEntitlement = resignApprovalEntitlement({
  ...structuredClone(approvalEntitlement),
  provider_name: "Provider 😀",
});
validateOperatorEntitlement(validSupplementaryEntitlement, operator, approvalTrust);
assert.equal(parseProtocolJson(JSON.stringify({ provider_name: "Provider 😀" })).provider_name, "Provider 😀");
const escapedProtocolJson = String.raw`{"value":"quote:\" slash:\/ backslash:\\ controls:\b\f\n\r\t letter:\u0041"}`;
assert.deepEqual(parseProtocolJson(escapedProtocolJson), JSON.parse(escapedProtocolJson), "strict scanner and JSON parser must agree on every JSON string escape");
function claimResponseWithRawWorkText(rawWork) {
  const claim = structuredClone(fixtures.get("publication-work-claim.json"));
  const workText = JSON.stringify(claim.publication_work[0]);
  return JSON.stringify(claim).replace(workText, rawWork);
}

function claimResponseWithRawWorkSize(targetBytes, placement = "inside", work = fixtures.get("publication-work-claim.json").publication_work[0]) {
  const workText = JSON.stringify(work);
  const padding = " ".repeat(targetBytes - Buffer.byteLength(workText));
  const rawWork = placement === "leading"
    ? `${padding}${workText}`
    : placement === "trailing"
      ? `${workText}${padding}`
      : `${workText.slice(0, -1)}${padding}}`;
  return claimResponseWithRawWorkText(rawWork);
}

function claimResponseWithItemCount(count) {
  const claim = structuredClone(fixtures.get("publication-work-claim.json"));
  claim.publication_work = Array.from({ length: count }, (_, index) => ({
    ...structuredClone(claim.publication_work[0]),
    work_id: `dbw_${index.toString(16).padStart(32, "0")}`,
  }));
  return JSON.stringify(claim);
}

validateClaimResponseText(claimResponseWithRawWorkSize(contract.publication_work.maximum_json_bytes), contract, fixtures.get("publication-work-claim-request.json"));
validateClaimResponseText(claimResponseWithRawWorkSize(contract.publication_work.maximum_json_bytes, "leading"), contract, fixtures.get("publication-work-claim-request.json"));
validateClaimResponseText(claimResponseWithRawWorkSize(contract.publication_work.maximum_json_bytes, "trailing"), contract, fixtures.get("publication-work-claim-request.json"));
const multibyteBoundaryWork = {
  ...structuredClone(fixtures.get("publication-work-claim.json").publication_work[0]),
  source_revision: "post:😀:version:4",
};
validateClaimResponseText(claimResponseWithRawWorkSize(contract.publication_work.maximum_json_bytes, "inside", multibyteBoundaryWork), contract, fixtures.get("publication-work-claim-request.json"));
assert.throws(
  () => validateClaimResponseText(claimResponseWithRawWorkSize(contract.publication_work.maximum_json_bytes + 1, "inside", multibyteBoundaryWork), contract, fixtures.get("publication-work-claim-request.json")),
  (error) => error instanceof ProtocolError && error.code === "validation_failed",
  "multibyte work item at maximum_json_bytes plus one must fail at the incremental raw-byte barrier",
);
validateClaimResponseText(
  JSON.stringify(fixtures.get("publication-work-claim.json")).replace('"publication_work"', '"publication_\\u0077ork"'),
  contract,
  fixtures.get("publication-work-claim-request.json"),
);
validateClaimResponseText(claimResponseWithItemCount(contract.publication_work.claim.maximum_items), contract);

function assertProtocolRejectionBeforeJsonParse(action, expectedCode, maximumParseCalls, message) {
  const originalJsonParse = JSON.parse;
  let parseCalls = 0;
  JSON.parse = (...args) => {
    parseCalls += 1;
    return originalJsonParse(...args);
  };
  try {
    assert.throws(action, (error) => error instanceof ProtocolError && error.code === expectedCode, message);
  } finally {
    JSON.parse = originalJsonParse;
  }
  assert.ok(parseCalls <= maximumParseCalls, `${message}: expected at most ${maximumParseCalls} JSON.parse calls, observed ${parseCalls}`);
}

assertProtocolRejectionBeforeJsonParse(
  () => validateCatalogSegmentText(`[${" ".repeat(contract.platform_catalog.maximum_json_bytes)}`, contract),
  "validation_failed",
  0,
  "oversized malformed catalog response must reject before parsing",
);
assertProtocolRejectionBeforeJsonParse(
  () => validateCatalogUpdateText(`[${" ".repeat(contract.platform_catalog.maximum_json_bytes)}`, contract),
  "validation_failed",
  0,
  "oversized malformed catalog request must reject before parsing",
);
assertProtocolRejectionBeforeJsonParse(
  () => validateErrorResponseText(`[${" ".repeat(contract.error_responses.maximum_json_bytes)}`, contract),
  "validation_failed",
  0,
  "oversized malformed error response must reject before parsing",
);
assertProtocolRejectionBeforeJsonParse(
  () => validateClaimResponseText(claimResponseWithRawWorkText("x".repeat(contract.publication_work.maximum_json_bytes + 1)), contract, fixtures.get("publication-work-claim-request.json")),
  "validation_failed",
  1,
  "oversized malformed work item must reject after bounded envelope-key decoding and before item parsing",
);
for (const [name, rawWork] of [
  ["invalid escape", `"\\q"`],
  ["unescaped control", `"\u0001"`],
  ["mismatched nesting", "[}"],
]) {
  assert.throws(
    () => validateClaimResponseText(claimResponseWithRawWorkText(rawWork), contract, fixtures.get("publication-work-claim-request.json")),
    (error) => error instanceof ProtocolError && error.code === "invalid_json",
    `within-limit ${name} must still reach strict JSON validation after bounded preflight`,
  );
}
const maximumWorkBytes = contract.publication_work.maximum_json_bytes;
const oversizedMalformedWorkItems = [
  ["early invalid escape", `"\\q${"x".repeat(maximumWorkBytes)}"`],
  ["late invalid escape", `"${"x".repeat(maximumWorkBytes - 1)}\\q"`],
  ["unescaped control", `"${"x".repeat(maximumWorkBytes - 1)}\u0001"`],
  ["unterminated string", `"${"x".repeat(maximumWorkBytes)}`],
  ["unterminated object", `{${" ".repeat(maximumWorkBytes)}`],
  ["unterminated array", `[${" ".repeat(maximumWorkBytes)}`],
  ["deep nested array", `${"[".repeat(maximumWorkBytes + 1)}${"]".repeat(maximumWorkBytes + 1)}`],
  ["mismatched nesting", `${"[".repeat(maximumWorkBytes)}}`],
];
for (const [name, rawWork] of oversizedMalformedWorkItems) {
  assertProtocolRejectionBeforeJsonParse(
    () => validateClaimResponseText(claimResponseWithRawWorkText(rawWork), contract, fixtures.get("publication-work-claim-request.json")),
    "validation_failed",
    1,
    `oversized ${name} work item must reach the incremental byte barrier before syntax parsing`,
  );
}

function assertNoOversizedWorkSlice(action, message) {
  const originalSlice = String.prototype.slice;
  let largestSlice = 0;
  String.prototype.slice = function instrumentedSlice(start = 0, end = this.length) {
    const length = this.length;
    const normalizedStart = start < 0 ? Math.max(length + start, 0) : Math.min(start, length);
    const normalizedEnd = end < 0 ? Math.max(length + end, 0) : Math.min(end, length);
    largestSlice = Math.max(largestSlice, Math.max(0, normalizedEnd - normalizedStart));
    return originalSlice.call(this, start, end);
  };
  try {
    assert.throws(action, (error) => error instanceof ProtocolError && error.code === "validation_failed", message);
  } finally {
    String.prototype.slice = originalSlice;
  }
  assert.ok(largestSlice <= maximumWorkBytes, `${message}: observed an oversized retained slice of ${largestSlice} code units`);
}

assertNoOversizedWorkSlice(
  () => validateClaimResponseText(claimResponseWithRawWorkText(`${"[".repeat(maximumWorkBytes + 1)}${"]".repeat(maximumWorkBytes + 1)}`), contract),
  "deep oversized work item must reject before whole-item slicing",
);
assertProtocolRejectionBeforeJsonParse(
  () => validateClaimResponseText(claimResponseWithItemCount(contract.publication_work.claim.maximum_items + 1), contract),
  "validation_failed",
  1,
  "claim item-count guard must reject before parsing a 33rd item",
);

validateOperatorEntitlement(fixtures.get("operator-entitlement.json"), operator, trust, {
  forumId: fixtures.get("operator-entitlement.json").forum_id,
  at: "2026-09-28T00:00:00Z",
  state: "active",
  scope: "retry_retryable_work",
  mutation: true,
});
validateOperatorEntitlement(fixtures.get("operator-entitlement.json"), operator, trust, {
  forumId: fixtures.get("operator-entitlement.json").forum_id,
  at: "2027-09-28T00:00:00Z",
  state: "grace_read_only",
  scope: "observe_health",
  mutation: false,
});

const baseComplete = fixtures.get("to-discourse-request.json").bridge_record;
const baseExcerpt = fixtures.get("to-discourse-excerpt-request.json").bridge_record;
const baseAck = fixtures.get("publication-acknowledgement.json");
const baseNetwork = fixtures.get("network-source-detail.json").network_provenance;
const validEntitlement = fixtures.get("operator-entitlement.json");

const negativeHandlers = {
  "acknowledgement-deployed-terminal.json": (value) => validateAcknowledgementResponse({ ...structuredClone(fixtures.get("publication-acknowledgement-responses.json").verified), accepted_stage: value.accepted_stage, terminal: value.terminal }, contract),
  "acknowledgement-revision-mismatch.json": (value) => validateAcknowledgementIdentity(value.work, { ...value.acknowledgement, stage: "synchronized" }, "leased", acknowledgementContext),
  "acknowledgement-stage-skipped.json": () => validateStageTransition(fixtures.get("publication-acknowledgement-static-pending.json"), fixtures.get("publication-acknowledgement.json"), fixtures.get("publication-acknowledgement-responses.json").synchronized),
  "acknowledgement-stale-stage-token.json": () => { const next = structuredClone(fixtures.get("publication-acknowledgement-static-deployed.json")); next.stage_token = fixtures.get("publication-acknowledgement-static-pending.json").stage_token; validateStageTransition(fixtures.get("publication-acknowledgement-static-pending.json"), next, fixtures.get("publication-acknowledgement-responses.json").synchronized); },
  "acknowledgement-verified-time-missing.json": () => { const value = structuredClone(baseAck); delete value.publicly_verified_at; validateAcknowledgement(value, contract); },
  "capability-missing-correlation.json": (value) => { const capability = structuredClone(fixtures.get("connection-capability.json")); delete capability[value.remove_field]; validateConnectionCapability(capability, contract); },
  "correlation-over-limit.json": (value) => validateConnectionCapability({ ...structuredClone(fixtures.get("connection-capability.json")), correlation_id: "x".repeat(value.byte_length) }, contract),
  "correlation-header-body-mismatch.json": (value) => { const exchange = structuredClone(value); delete exchange.expected_error; validateCorrelationExchange(exchange, contract); },
  "catalog-authority-expansion.json": (value) => validateDirection(value.connection, { direction: value.requested_direction }),
  "catalog-cursor-mismatch.json": (value) => validateCatalogCursor(value.request, value.binding),
  "catalog-over-limit.json": (value) => { const catalog = structuredClone(fixtures.get("platform-catalog-authors.json")); catalog.items = Array.from({ length: value.item_count }, (_, index) => ({ id: `author:${index}`, name: `Author ${index}`, available: true })); validateCatalogSegment(catalog, contract); },
  "catalog-stale-revision.json": (value) => { const update = structuredClone(fixtures.get("platform-catalog-update.json")); update.request.base_catalog_revision = value.request_base_catalog_revision; validateCatalogUpdate(update, contract, value.current_catalog_revision); },
  "catalog-removed-mapping.json": (value) => validateResolvedPolicy(value.policy, value.catalog_items),
  "catalog-unknown-field.json": (value) => validateCatalogSegment({ ...structuredClone(fixtures.get("platform-catalog-authors.json")), [value.field]: value.value }, contract),
  "excerpt-read-more-mismatch.json": (value) => validateResolveRecord({ ...structuredClone(baseExcerpt), ...value.bridge_record }, contract),
  "full-interactive-request.json": (value) => validatePresentationMode(value.bridge_record.presentation_mode, contract),
  "identity-url-conflict.json": (value) => validateIdentity(value.stored, value.incoming),
  "lease-expired.json": (value) => validateLeaseTime(value.lease_expires_at, value.request_received_at),
  "lease-renewal-over-limit.json": (value) => validateLeaseRenewal(value.current_total_lease_seconds, value.requested_lease_seconds, value.maximum_total_lease_seconds),
  "malformed-timestamp.json": (value) => validateResolveRecord({ ...structuredClone(baseComplete), source_updated_at: value.source_updated_at }, contract),
  "network-loop.json": (value) => validateNetwork(value.network_provenance, contract, value.local_forum_id),
  "network-clone-identity-collision.json": (value) => validateForumClone(value.existing_forum_id, value.clone_forum_id, value.rotated_and_reauthorized),
  "network-operation-replay-mismatch.json": (value) => validateReplay(value.stored, value.replay),
  "network-repeated-route.json": (value) => validateNetwork({ ...structuredClone(baseNetwork), ...value.network_provenance }, contract, null),
  "network-route-over-limit.json": (value) => validateNetwork({ ...structuredClone(baseNetwork), route_forum_ids: value.route_forum_ids }, contract, null),
  "network-self-origin.json": (value) => validateNetwork({ ...structuredClone(baseNetwork), ...value.network_provenance }, contract, value.local_forum_id),
  "network-unsupported-scope.json": (value) => validateNetwork({ ...structuredClone(baseNetwork), ...value.network_provenance }, contract, null),
  "network-unauthorized-sender.json": (value) => validateNetworkRoute({ ...structuredClone(fixtures.get("network-route-append.json")), authorized_peer: value.authorized_peer }, contract),
  "operator-entitlement-expired.json": validateEntitlementTime,
  "operator-entitlement-grace-mutation.json": (value) => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: validEntitlement.forum_id, at: value.request_at, state: "grace_read_only", scope: "retry_retryable_work", mutation: value.mutation }),
  "operator-entitlement-invalid-signature.json": (value) => validateOperatorEntitlement({ ...structuredClone(validEntitlement), ...value.entitlement }, operator, trust),
  "operator-entitlement-not-yet-valid.json": (value) => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: validEntitlement.forum_id, at: value.request_at, state: "active", scope: "retry_retryable_work", mutation: true }),
  "operator-entitlement-noncanonical-signature.json": (value) => validateOperatorEntitlement({ ...structuredClone(validEntitlement), signature: value.signature }, operator, trust),
  "operator-entitlement-replaced.json": (value) => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: validEntitlement.forum_id, at: "2026-09-28T00:00:00Z", state: value.state, scope: "retry_retryable_work", mutation: true }),
  "operator-entitlement-revoked.json": (value) => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: validEntitlement.forum_id, at: "2026-09-28T00:00:00Z", state: value.state, scope: "retry_retryable_work", mutation: true }),
  "operator-entitlement-wrong-forum.json": (value) => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: value.local_forum_id, at: "2026-09-28T00:00:00Z", state: "active", scope: "retry_retryable_work", mutation: true }),
  "operator-entitlement-wrong-scope.json": (value) => validateOperatorEntitlement(value.entitlement, operator, trust),
  "over-limit-title.json": () => validateResolveRecord({ ...structuredClone(baseComplete), title: "x".repeat(contract.resolve.field_rules.title_maximum_bytes + 1) }, contract),
  "revision-sequence-conflict.json": (value) => validateRevisionTransition(value.stored, value.incoming),
  "revocation-cursor-mismatch.json": (value) => validateRevocationCursor(value.request, value.binding),
  "secret-leak-error.json": (value) => validateErrorResponse(value.error_response, contract, [value.headers[contract.authentication.secret_header]]),
  "snapshot-cursor-mismatch.json": (value) => validateCursorSnapshot(value.request, value.cursor_binding),
  "source-content-integrity.json": (value) => validateChunkSet(value.descriptor, value.chunks, contract),
  "source-content-over-bound.json": (value) => validateResolveRecord({ ...structuredClone(baseComplete), source_content_bytes: value.source_content_bytes }, contract),
  "source-url-broken-ancestry.json": validateUrlProof,
  "source-url-destination-collision.json": validateDestinationCollision,
  "source-url-retired-conflict.json": validateRetiredUrl,
  "stale-revision-request.json": (value) => validateRevisionTransition(value.stored, value.incoming),
  "unknown-field.json": (value) => validateResolveRecord({ ...structuredClone(baseComplete), ...value.bridge_record }, contract),
  "work-superseded.json": (value) => validateAcknowledgementIdentity(value.leased_work, value.late_acknowledgement, value.leased_work.state),
  "wrong-connection-scope.json": (value) => validateScope(value.connection, value.request),
  "wrong-contract-version.json": (value) => validateContractHeader(value.headers, contract),
  "wrong-direction.json": (value) => validateDirection(value.connection, value.request),
  "wrong-lease-token.json": (value) => validateAcknowledgement({ ...structuredClone(fixtures.get("publication-acknowledgement-create.json")), lease_token: value.acknowledgement.lease_token }, contract),
};

assert.deepEqual(Object.keys(negativeHandlers).sort(), negativeNames, "negative fixture corpus and handlers must agree bidirectionally");

for (const name of negativeNames) {
  const fixture = invalid.get(name);
  assert.ok(negativeHandlers[name], `negative fixture has no validator: ${name}`);
  assert.throws(
    () => negativeHandlers[name](fixture),
    (error) => error instanceof ProtocolError && error.code === fixture.expected_error,
    `${name} must fail with ${fixture.expected_error}`,
  );
}

const mutationCases = [
  ["missing required field", () => { const value = structuredClone(baseComplete); delete value.source_revision; validateResolveRecord(value, contract); }, "validation_failed"],
  ["unknown field", () => validateResolveRecord({ ...structuredClone(baseComplete), invented_control: true }, contract), "unknown_field"],
  ["invalid enum", () => validateResolveRecord({ ...structuredClone(baseComplete), presentation_mode: "fullInteractive" }, contract), "validation_failed"],
  ["content bound", () => validateResolveRecord({ ...structuredClone(baseComplete), source_content_bytes: contract.resolve.source_content_maximum_bytes + 1 }, contract), "validation_failed"],
  ["content hash", () => validateResolveRecord({ ...structuredClone(baseComplete), source_content_sha256: "0".repeat(64) }, contract), "integrity_failed"],
  ["signature", () => { const value = structuredClone(validEntitlement); value.signature = `${value.signature[0] === "A" ? "B" : "A"}${value.signature.slice(1)}`; validateOperatorEntitlement(value, operator, trust); }, "entitlement_invalid_signature"],
  ["authentication unknown field", () => validateAuthenticationHeaders({ ...structuredClone(fixtures.get("authentication-headers.json")), unexpected: true }, contract), "unknown_field"],
  ["capability unknown field", () => validateConnectionCapability({ ...structuredClone(fixtures.get("connection-capability.json")), unexpected: true }, contract), "unknown_field"],
  ["capability raw aggregate over limit", () => validateConnectionCapabilityText(`${jsonTextAtSize(fixtures.get("connection-capability.json"), contract.connection_capability.maximum_json_bytes)} `, contract), "validation_failed"],
  ["capability lane count over limit", () => { const value = structuredClone(maximumLaneCapability); value.lanes.push("one-too-many"); validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability lane bytes over limit", () => { const value = structuredClone(fixtures.get("connection-capability.json")); value.lanes = ["x".repeat(contract.connection_capability.lane_maximum_bytes + 1)]; validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability policy count over limit", () => { const value = structuredClone(maximumPolicyCapability); value.destination_policies.push({ ...structuredClone(value.destination_policies[0]), destination_policy_id: "policy:over" }); validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability taxonomy mapping count over limit", () => { const value = structuredClone(maximumMappingCapability); value.destination_policies[0].taxonomy_mapping.items.push({ source: "over", destination: "d" }); validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability author mapping count over limit", () => { const value = structuredClone(maximumAuthorMappingCapability); value.destination_policies[0].author_mapping.items.push({ source: "over", destination: "d" }); validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability duplicate taxonomy mapping source", () => { const value = structuredClone(fixtures.get("connection-capability.json")); value.destination_policies[0].taxonomy_mapping.items = [{ source: "same", destination: "a" }, { source: "same", destination: "b" }]; validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability duplicate author mapping source", () => { const value = structuredClone(fixtures.get("connection-capability.json")); value.destination_policies[0].author_mapping.items = [{ source: "same", destination: "a" }, { source: "same", destination: "b" }]; validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability mapping identifier over limit", () => { const value = structuredClone(fixtures.get("connection-capability.json")); value.destination_policies[0].container_mapping.source = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1); validateConnectionCapability(value, contract); }, "validation_failed"],
  ["record index unknown field", () => validateRecordIndex({ ...structuredClone(fixtures.get("bridge-record-index.json")), unexpected: true }, contract), "unknown_field"],
  ["record show unknown field", () => validateRecordShow({ ...structuredClone(fixtures.get("from-discourse-record.json")), unexpected: true }, contract), "unknown_field"],
  ["inventory unknown field", () => validateInventory({ ...structuredClone(fixtures.get("source-inventory-page.json")), unexpected: true }, contract), "unknown_field"],
  ["source detail unknown field", () => validateSourceDetail({ ...structuredClone(fixtures.get("source-detail-inline.json")), unexpected: true }, contract), "unknown_field"],
  ["source detail raw aggregate over limit", () => validateSourceDetailText(`${jsonTextAtSize(fixtures.get("source-detail-inline.json"), contract.source_publication.detail.maximum_json_bytes)} `, contract), "validation_failed"],
  ["source detail duplicate category", () => { const value = structuredClone(fixtures.get("source-detail-inline.json")); value.categories = [value.categories[0], structuredClone(value.categories[0])]; validateSourceDetail(value, contract); }, "validation_failed"],
  ["source detail duplicate tag", () => { const value = structuredClone(fixtures.get("source-detail-inline.json")); value.tags = [value.tags[0], structuredClone(value.tags[0])]; validateSourceDetail(value, contract); }, "validation_failed"],
  ["source detail category id over limit", () => { const value = structuredClone(fixtures.get("source-detail-inline.json")); value.categories[0].source_category_id = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1); validateSourceDetail(value, contract); }, "validation_failed"],
  ["source detail category name over limit", () => { const value = structuredClone(fixtures.get("source-detail-inline.json")); value.categories[0].source_category_name = "x".repeat(contract.common.descriptive_name_maximum_bytes + 1); validateSourceDetail(value, contract); }, "validation_failed"],
  ["source detail tag id over limit", () => { const value = structuredClone(fixtures.get("source-detail-inline.json")); value.tags[0].source_tag_id = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1); validateSourceDetail(value, contract); }, "validation_failed"],
  ["source detail tag name over limit", () => { const value = structuredClone(fixtures.get("source-detail-inline.json")); value.tags[0].source_tag_name = "x".repeat(contract.common.descriptive_name_maximum_bytes + 1); validateSourceDetail(value, contract); }, "validation_failed"],
  ["URL proof unknown field", () => validateUrlProofResponse({ ...structuredClone(fixtures.get("source-url-proof.json")), unexpected: true }, contract), "unknown_field"],
  ["revocation index unknown field", () => validateRevocationIndex({ ...structuredClone(fixtures.get("source-revocation-index.json")), unexpected: true }, contract), "unknown_field"],
  ["revocation detail unknown field", () => validateRevocationDetail({ ...structuredClone(fixtures.get("source-revocation.json")), unexpected: true }, contract), "unknown_field"],
  ["claim request unknown field", () => validateClaimRequest({ ...structuredClone(fixtures.get("publication-work-claim-request.json")), unexpected: true }, contract), "unknown_field"],
  ["claim response unknown field", () => validateClaimResponse({ ...structuredClone(fixtures.get("publication-work-claim.json")), unexpected: true }, contract), "unknown_field"],
  ["work raw aggregate over limit", () => validateClaimResponseText(claimResponseWithRawWorkSize(contract.publication_work.maximum_json_bytes + 1), contract, fixtures.get("publication-work-claim-request.json")), "validation_failed"],
  ["work raw leading whitespace over limit", () => validateClaimResponseText(claimResponseWithRawWorkSize(contract.publication_work.maximum_json_bytes + 1, "leading"), contract, fixtures.get("publication-work-claim-request.json")), "validation_failed"],
  ["work raw trailing whitespace over limit", () => validateClaimResponseText(claimResponseWithRawWorkSize(contract.publication_work.maximum_json_bytes + 1, "trailing"), contract, fixtures.get("publication-work-claim-request.json")), "validation_failed"],
  ["work malformed raw item over limit before parse", () => validateClaimResponseText(claimResponseWithRawWorkText("x".repeat(contract.publication_work.maximum_json_bytes + 1)), contract, fixtures.get("publication-work-claim-request.json")), "validation_failed"],
  ["claim response raw item count over limit", () => validateClaimResponseText(claimResponseWithItemCount(contract.publication_work.claim.maximum_items + 1), contract), "validation_failed"],
  ["work taxonomy count over limit", () => { const value = structuredClone(maximumWork); value.resolved_taxonomy.push({ source_id: "over", destination_id: "d" }); validateWork(value, contract); }, "validation_failed"],
  ["work duplicate taxonomy source", () => { const value = structuredClone(fixtures.get("publication-work-claim.json").publication_work[0]); value.resolved_taxonomy = [{ source_id: "same", destination_id: "a" }, { source_id: "same", destination_id: "b" }]; validateWork(value, contract); }, "validation_failed"],
  ["work destination policy id over limit", () => { const value = structuredClone(fixtures.get("publication-work-claim.json").publication_work[0]); value.destination_policy_id = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1); validateWork(value, contract); }, "validation_failed"],
  ["work container kind over limit", () => { const value = structuredClone(fixtures.get("publication-work-claim.json").publication_work[0]); value.resolved_container.kind = "x".repeat(contract.publication_work.resolved_mapping_rules.container_kind_maximum_bytes + 1); validateWork(value, contract); }, "validation_failed"],
  ["renewal unknown field", () => { const value = structuredClone(fixtures.get("publication-lease-renewal.json")); value.request.unexpected = true; validateRenewal(value, contract, renewalContext); }, "unknown_field"],
  ["acknowledgement unknown field", () => validateAcknowledgement({ ...structuredClone(baseAck), unexpected: true }, contract), "unknown_field"],
  ["acknowledgement response unknown field", () => validateAcknowledgementResponse({ ...structuredClone(fixtures.get("publication-acknowledgement-responses.json").verified), unexpected: true }, contract), "unknown_field"],
  ["failure unknown field", () => validateFailure({ ...structuredClone(fixtures.get("publication-failure.json")), unexpected: true }, contract), "unknown_field"],
  ["catalog unknown field", () => validateCatalogSegment({ ...structuredClone(fixtures.get("platform-catalog-authors.json")), unexpected: true }, contract), "unknown_field"],
  ["error unknown field", () => validateErrorResponse({ ...structuredClone(fixtures.get("rejected-response.json")), unexpected: true }, contract), "unknown_field"],
  ["operator entitlement unknown field", () => validateOperatorEntitlement({ ...structuredClone(validEntitlement), unexpected: true }, operator, trust), "unknown_field"],
  ["operator audit unknown field", () => validateOperatorAudit({ ...structuredClone(fixtures.get("operator-enrollment-audit.json")), unexpected: true }, operator), "unknown_field"],
  ["resolve published false", () => validateResolveRecord({ ...structuredClone(baseComplete), published: false }, contract), "validation_failed"],
  ["resolve null source revision", () => validateResolveRecord({ ...structuredClone(baseComplete), source_revision: null }, contract), "validation_failed"],
  ["resolve blank source revision", () => validateResolveRecord({ ...structuredClone(baseComplete), source_revision: "" }, contract), "validation_failed"],
  ["resolve oversized source revision", () => validateResolveRecord({ ...structuredClone(baseComplete), source_revision: "x".repeat(contract.common.source_revision_maximum_bytes + 1) }, contract), "validation_failed"],
  ["resolve executable canonical URL", () => validateResolveRecord({ ...structuredClone(baseComplete), canonical_url: "javascript:alert(1)" }, contract), "validation_failed"],
  ["resolve private visibility", () => validateResolveRecord({ ...structuredClone(baseComplete), visibility: "private" }, contract), "validation_failed"],
  ["resolve oversized lane", () => validateResolveRecord({ ...structuredClone(baseComplete), lane: "x".repeat(contract.resolve.field_rules.lane_maximum_bytes + 1) }, contract), "validation_failed"],
  ["resolve negative existing topic", () => validateResolveRecord({ ...structuredClone(baseComplete), existing_topic_id: -1 }, contract), "validation_failed"],
  ["resolve excessive authors", () => validateResolveRecord({ ...structuredClone(baseComplete), source_authors: Array.from({ length: contract.resolve.field_rules.source_authors_maximum_items + 1 }, () => ({})) }, contract), "validation_failed"],
  ["resolve oversized adapter identity", () => validateResolveRecord({ ...structuredClone(baseComplete), adapter_id: "x".repeat(contract.resolve.field_rules.adapter_id_maximum_bytes + 1) }, contract), "validation_failed"],
  ["resolve complete envelope ceiling", () => validateResolveRecord(resolveEnvelopeAtSize(contract.resolve.maximum_json_bytes + 1), contract), "validation_failed"],
  ["resolve missing body correlation", () => { const value = structuredClone(baseComplete); delete value.correlation_id; validateResolveRecord(value, contract); }, "validation_failed"],
  ["resolve response null identity", () => validateResolveResponse({ ...structuredClone(fixtures.get("resolved-response.json")), resource_id: null }, contract.resolve.success_response_required_fields, contract), "validation_failed"],
  ["resolve response arbitrary outcome", () => validateResolveResponse({ ...structuredClone(fixtures.get("resolved-response.json")), outcome: "maybe" }, contract.resolve.success_response_required_fields, contract), "validation_failed"],
  ["resolve response wrong direction", () => validateResolveResponse({ ...structuredClone(fixtures.get("resolved-response.json")), direction: "from_discourse" }, contract.resolve.success_response_required_fields, contract), "validation_failed"],
  ["resolve response executable topic URL", () => validateResolveResponse({ ...structuredClone(fixtures.get("resolved-response.json")), topic_url: "javascript:alert(1)" }, contract.resolve.success_response_required_fields, contract), "validation_failed"],
  ["impossible calendar timestamp", () => validateResolveRecord({ ...structuredClone(baseComplete), source_updated_at: "2026-02-30T12:00:00Z" }, contract), "malformed_value"],
  ["hour 24 timestamp", () => validateResolveRecord({ ...structuredClone(baseComplete), source_updated_at: "2026-09-27T24:00:00Z" }, contract), "malformed_value"],
  ["renewal negative total", () => { const value = structuredClone(fixtures.get("publication-lease-renewal.json")); value.response.total_lease_seconds = -1; validateRenewal(value, contract, renewalContext); }, "validation_failed"],
  ["renewal nonnumeric total", () => { const value = structuredClone(fixtures.get("publication-lease-renewal.json")); value.response.total_lease_seconds = "1200"; validateRenewal(value, contract, renewalContext); }, "validation_failed"],
  ["catalog compact aggregate byte ceiling", () => validateCatalogUpdate(fullyPopulatedCatalogUpdate(), contract), "validation_failed"],
  ["catalog response raw byte ceiling", () => validateCatalogSegmentText(jsonTextAtSize(fixtures.get("platform-catalog-authors.json"), contract.platform_catalog.maximum_json_bytes + 1), contract), "validation_failed"],
  ["catalog response malformed over limit before parse", () => validateCatalogSegmentText(`[${" ".repeat(contract.platform_catalog.maximum_json_bytes)}`, contract), "validation_failed"],
  ["catalog request raw byte ceiling", () => validateCatalogUpdateText(catalogRequestTextAtSize(contract.platform_catalog.maximum_json_bytes + 1), contract), "validation_failed"],
  ["catalog request leading whitespace byte ceiling", () => validateCatalogUpdateText(catalogRequestTextAtSize(contract.platform_catalog.maximum_json_bytes + 1, "leading"), contract), "validation_failed"],
  ["catalog request trailing whitespace byte ceiling", () => validateCatalogUpdateText(catalogRequestTextAtSize(contract.platform_catalog.maximum_json_bytes + 1, "trailing"), contract), "validation_failed"],
  ["catalog request malformed over limit before parse", () => validateCatalogUpdateText(`[${" ".repeat(contract.platform_catalog.maximum_json_bytes)}`, contract), "validation_failed"],
  ["catalog item id over limit", () => { const value = structuredClone(fixtures.get("platform-catalog-authors.json")); value.items[0].id = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1); validateCatalogSegment(value, contract); }, "validation_failed"],
  ["catalog item name over limit", () => { const value = structuredClone(fixtures.get("platform-catalog-authors.json")); value.items[0].name = "x".repeat(contract.common.descriptive_name_maximum_bytes + 1); validateCatalogSegment(value, contract); }, "validation_failed"],
  ["catalog container kind over limit", () => { const value = structuredClone(fixtures.get("platform-catalog-containers.json")); value.items[0].kind = "x".repeat(contract.platform_catalog.container_kind_maximum_bytes + 1); validateCatalogSegment(value, contract); }, "validation_failed"],
  ["catalog taxonomy id over limit", () => { const value = structuredClone(fixtures.get("platform-catalog-terms.json")); value.items[0].taxonomy_id = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1); validateCatalogSegment(value, contract); }, "validation_failed"],
  ["catalog parent id over limit", () => { const value = structuredClone(fixtures.get("platform-catalog-terms.json")); value.items[0].parent_id = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1); validateCatalogSegment(value, contract); }, "validation_failed"],
  ["catalog response revision over limit", () => { const value = structuredClone(fixtures.get("platform-catalog-authors.json")); value.catalog_revision = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1); validateCatalogSegment(value, contract); }, "validation_failed"],
  ["catalog update base revision over limit", () => { const value = structuredClone(fixtures.get("platform-catalog-update.json")); value.request.base_catalog_revision = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1); validateCatalogUpdate(value, contract); }, "validation_failed"],
  ["catalog update response revision over limit", () => { const value = structuredClone(fixtures.get("platform-catalog-update.json")); value.response.catalog_revision = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1); validateCatalogUpdate(value, contract); }, "validation_failed"],
  ["record index page ceiling", () => { const value = structuredClone(fixtures.get("bridge-record-index.json")); value.page = contract.records.maximum_page + 1; value.total_pages = value.page; validateRecordIndex(value, contract); }, "validation_failed"],
  ["operator audit malformed forum", () => validateOperatorAudit({ ...structuredClone(fixtures.get("operator-enrollment-audit.json")), forum_id: "invalid" }, operator), "validation_failed"],
  ["cutover null receiver schema", () => validateCutoverManifest({ ...structuredClone(fixtures.get("cutover-manifest.json")), receiver_schema: null }, contract), "validation_failed"],
  ["cutover rehearsal manifest mismatch", () => validateCutoverRehearsal({ ...structuredClone(fixtures.get("cutover-rehearsal.json")), manifest_id: "dbm_22222222222222222222222222222222" }, fixtures.get("cutover-manifest.json"), contract), "reconciliation_required"],
  ["cutover rehearsal artifact mismatch", () => { const manifest = structuredClone(fixtures.get("cutover-manifest.json")); manifest.adapter_protocol.sha256 = "f".repeat(64); validateCutoverRehearsal(fixtures.get("cutover-rehearsal.json"), manifest, contract); }, "reconciliation_required"],
  ["oversized error response", () => { const value = structuredClone(fixtures.get("rejected-response.json")); value.message = "x".repeat(contract.error_responses.maximum_json_bytes); validateErrorResponse(value, contract); }, "validation_failed"],
  ["error response raw byte ceiling", () => validateErrorResponseText(jsonTextAtSize(fixtures.get("rejected-response.json"), contract.error_responses.maximum_json_bytes + 1), contract), "validation_failed"],
  ["error response malformed over limit before parse", () => validateErrorResponseText(`[${" ".repeat(contract.error_responses.maximum_json_bytes)}`, contract), "validation_failed"],
  ...[null, 1, true, [], {}].map((message) => [
    `error response malformed message ${JSON.stringify(message)}`,
    () => validateErrorResponse({ ...structuredClone(fixtures.get("rejected-response.json")), message }, contract),
    "validation_failed",
  ]),
  ["capability invented direction", () => { const value = structuredClone(fixtures.get("connection-capability.json")); value.directions = ["delete_everything"]; validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability invalid authority metadata", () => { const value = structuredClone(fixtures.get("connection-capability.json")); value.lanes = [""]; value.catalog_required = "yes"; value.policy_revision = ""; value.supported_operations = ["resolve", "resolve"]; validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability malformed nested mapping", () => { const value = structuredClone(fixtures.get("connection-capability.json")); value.destination_policies[0].author_mapping.items = [null]; validateConnectionCapability(value, contract); }, "validation_failed"],
  ["catalog malformed nested item", () => { const value = structuredClone(fixtures.get("platform-catalog-update.json")); value.request.segments[0].items = [{ id: "", name: 123, available: "yes", unexpected: true }]; validateCatalogUpdate(value, contract); }, "unknown_field"],
  ["catalog response scope mismatch", () => { const value = structuredClone(fixtures.get("platform-catalog-update.json")); value.response.platform_profile = "wordpress"; validateCatalogUpdate(value, contract); }, "validation_failed"],
  ["catalog response correlation mismatch direct", () => { const value = structuredClone(fixtures.get("platform-catalog-update.json")); value.response.correlation_id = "catalog-update-other"; validateCatalogUpdateResponse(value.response, value.request, contract); }, "validation_failed"],
  ["catalog accepted segments mismatch", () => { const value = structuredClone(fixtures.get("platform-catalog-update.json")); value.response.accepted_segments = ["native_limits"]; validateCatalogUpdate(value, contract); }, "validation_failed"],
  ["network malformed provenance", () => { const value = structuredClone(fixtures.get("network-source-detail.json")); value.network_provenance.origin_forum_id = "invalid"; value.network_provenance.operation_id = "reuse-me"; value.network_provenance.origin_topic_url = "javascript:alert(1)"; validateSourceDetail(value, contract); }, "validation_failed"],
  ["pending binding premature deployed timestamp", () => { const value = structuredClone(pendingRecord); value.bindings[0].deployed_at = "2026-09-27T18:31:30Z"; validateRecordShow({ bridge_record: value, correlation_id: "pending-binding-02" }, contract); }, "validation_failed"],
  ["pre-ack binding partial synchronization facts", () => { const value = structuredClone(preAcknowledgementRecord); value.bindings[0].publication_revision = "invented:revision"; validateRecordShow({ bridge_record: value, correlation_id: "pre-ack-migration-02" }, contract); }, "validation_failed"],
  ["acknowledgement illegal current state", () => validateAcknowledgementIdentity(fixtures.get("publication-work-claim.json").publication_work[0], fixtures.get("publication-acknowledgement-static-pending.json"), "available"), "stage_conflict"],
  ["deployed acknowledgement against leased work", () => validateAcknowledgementIdentity(fixtures.get("publication-work-claim.json").publication_work[0], fixtures.get("publication-acknowledgement-static-deployed.json"), "leased"), "stage_conflict"],
  ["valid-shaped wrong lease token", () => { const work = fixtures.get("publication-work-claim.json").publication_work[0]; const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.lease_token = "d".repeat(64); validateAcknowledgement(ack, contract); validateAcknowledgementIdentity(work, ack, "leased", acknowledgementContext); }, "reconciliation_required"],
  ["valid-shaped wrong stage token", () => { const work = fixtures.get("publication-work-claim.json").publication_work[0]; const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.stage_token = "d".repeat(64); validateAcknowledgement(ack, contract); validateAcknowledgementIdentity(work, ack, "leased", acknowledgementContext); }, "stage_conflict"],
  ["wrong acknowledgement resource", () => { const work = fixtures.get("publication-work-claim.json").publication_work[0]; const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.resource_id = "b4965d46-e657-4af4-af47-6439e544eeb8"; validateAcknowledgementIdentity(work, ack, "leased", acknowledgementContext); }, "identity_conflict"],
  ["wrong acknowledgement destination policy", () => { const work = fixtures.get("publication-work-claim.json").publication_work[0]; const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.destination_policy_id = "destination:other:1"; validateAcknowledgementIdentity(work, ack, "leased", acknowledgementContext); }, "identity_conflict"],
  ["wrong acknowledgement action", () => { const work = fixtures.get("publication-work-claim.json").publication_work[0]; const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.action = "publish"; validateAcknowledgementIdentity(work, ack, "leased", acknowledgementContext); }, "identity_conflict"],
  ["expired first acknowledgement", () => validateAcknowledgementIdentity(fixtures.get("publication-work-claim.json").publication_work[0], fixtures.get("publication-acknowledgement-static-pending.json"), "leased", { ...acknowledgementContext, received_at: "2026-09-27T18:36:00Z" }), "work_expired"],
  ["synchronization after receipt", () => { const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.synchronized_at = "2026-09-27T18:31:01Z"; validateAcknowledgementIdentity(fixtures.get("publication-work-claim.json").publication_work[0], ack, "leased", acknowledgementContext); }, "validation_failed"],
  ["synchronization before claim", () => { const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.synchronized_at = "2026-09-27T18:29:00Z"; validateAcknowledgementIdentity(fixtures.get("publication-work-claim.json").publication_work[0], ack, "leased", { received_at: "2026-09-27T18:31:00Z", claimed_at: claimedWorkFixture.claimed_at, destination_mode: "static" }); }, "validation_failed"],
  ["unissued next stage token", () => { const previous = fixtures.get("publication-acknowledgement-static-pending.json"); const next = structuredClone(fixtures.get("publication-acknowledgement-static-deployed.json")); next.stage_token = "a".repeat(64); validateStageTransition(previous, next, fixtures.get("publication-acknowledgement-responses.json").synchronized); }, "stage_conflict"],
  ["terminal dynamic acknowledgement advancement", () => validateStageTransition(fixtures.get("publication-acknowledgement-create.json"), fixtures.get("publication-acknowledgement-static-deployed.json"), { ...fixtures.get("publication-acknowledgement-responses.json").dynamic, terminal: false, next_stage_token: "3".repeat(64) }), "stage_conflict"],
  ["stage transition changed synchronized time", () => { const next = structuredClone(fixtures.get("publication-acknowledgement-static-deployed.json")); next.synchronized_at = "2026-09-27T18:31:01Z"; validateStageTransition(fixtures.get("publication-acknowledgement-static-pending.json"), next, fixtures.get("publication-acknowledgement-responses.json").synchronized); }, "identity_conflict"],
  ["stage transition changed deployed time", () => { const next = structuredClone(fixtures.get("publication-acknowledgement.json")); next.deployed_at = "2026-09-27T18:31:40Z"; validateStageTransition(fixtures.get("publication-acknowledgement-static-deployed.json"), next, fixtures.get("publication-acknowledgement-responses.json").deployed); }, "identity_conflict"],
  ["deployment before synchronization", () => { const value = structuredClone(fixtures.get("publication-acknowledgement-static-deployed.json")); value.deployed_at = "2026-09-27T18:30:59Z"; validateAcknowledgement(value, contract); }, "validation_failed"],
  ["verification before deployment", () => { const value = structuredClone(fixtures.get("publication-acknowledgement.json")); value.publicly_verified_at = "2026-09-27T18:31:29Z"; validateAcknowledgement(value, contract); }, "validation_failed"],
  ["deployment after receipt", () => validateAcknowledgementIdentity({ ...fixtures.get("publication-work-claim.json").publication_work[0], stage_token: fixtures.get("publication-acknowledgement-static-deployed.json").stage_token }, { ...fixtures.get("publication-acknowledgement-static-deployed.json"), deployed_at: "2026-09-27T18:36:30Z" }, "awaiting_deployment", { received_at: "2026-09-27T18:36:00Z", destination_mode: "static" }), "validation_failed"],
  ["verification after receipt", () => validateAcknowledgementIdentity({ ...fixtures.get("publication-work-claim.json").publication_work[0], stage_token: fixtures.get("publication-acknowledgement.json").stage_token }, { ...fixtures.get("publication-acknowledgement.json"), publicly_verified_at: "2026-09-27T18:38:00Z" }, "awaiting_verification", { received_at: "2026-09-27T18:37:00Z", destination_mode: "static" }), "validation_failed"],
  ["same revision reused at higher sequence", () => { const stored = { source_revision: "revision:1", source_revision_sequence: 1, source_content_sha256: "a".repeat(64) }; const incoming = { source_revision: "revision:1", source_revision_sequence: 2, source_content_sha256: "b".repeat(64) }; validateRevisionTransition(stored, incoming); }, "reconciliation_required"],
  ["cursor connection mismatch", () => validateCursorSnapshot({ snapshot: "snap:1", connection_id: "dbc_222222222222222222222222", policy_revision: "policy:1" }, { snapshot: "snap:1", connection_id: "dbc_111111111111111111111111", policy_revision: "policy:1" }), "cursor_snapshot_mismatch"],
  ["cursor policy mismatch", () => validateCursorSnapshot({ snapshot: "snap:1", connection_id: "dbc_111111111111111111111111", policy_revision: "policy:2" }, { snapshot: "snap:1", connection_id: "dbc_111111111111111111111111", policy_revision: "policy:1" }), "cursor_snapshot_mismatch"],
  ["removed direct author mapping", () => validateResolvedPolicy({ container_mapping: {}, taxonomy_mapping: { items: [] }, author_mapping: { destination_id: "author:removed", items: [] } }, [{ id: "author:removed", available: false }]), "policy_denied"],
  ["same forum clone after claimed rotation", () => validateForumClone("dbf_11111111111111111111111111111111", "dbf_11111111111111111111111111111111", true), "identity_conflict"],
  ["claim expired before issuance", () => { const value = structuredClone(fixtures.get("publication-work-claim.json")); value.publication_work[0].lease_expires_at = "2026-09-27T18:29:59Z"; validateClaimResponse(value, contract); }, "work_expired"],
  ["claim exceeds initial lease ceiling", () => { const value = structuredClone(fixtures.get("publication-work-claim.json")); value.publication_work[0].lease_expires_at = "2026-09-27T23:30:00Z"; validateClaimResponse(value, contract); }, "lease_limit_exceeded"],
  ["claim exceeds requested lease fractionally", () => { const value = structuredClone(fixtures.get("publication-work-claim.json")); value.publication_work[0].lease_expires_at = "2026-09-27T18:40:00.0001Z"; validateClaimResponse(value, contract, fixtures.get("publication-work-claim-request.json")); }, "validation_failed"],
  ["claim correlation mismatch", () => { const request = { ...fixtures.get("publication-work-claim-request.json"), correlation_id: "different-claim" }; validateClaimResponse(fixtures.get("publication-work-claim.json"), contract, request); }, "validation_failed"],
  ["renewal valid-shaped foreign lease", () => { const value = structuredClone(fixtures.get("publication-lease-renewal.json")); value.request.lease_token = "d".repeat(64); validateRenewal(value, contract, renewalContext); }, "lease_conflict"],
  ["renewal inactive work", () => validateRenewal(fixtures.get("publication-lease-renewal.json"), contract, { ...renewalContext, state: "retry_wait" }), "lease_conflict"],
  ["renewal inconsistent total", () => { const value = structuredClone(fixtures.get("publication-lease-renewal.json")); value.response.total_lease_seconds = 1; validateRenewal(value, contract, renewalContext); }, "validation_failed"],
  ["renewal truncated fractional expiry", () => validateRenewal(fixtures.get("publication-lease-renewal.json"), contract, { ...renewalContext, work: { ...renewalContext.work, lease_expires_at: "2026-09-27T18:35:00.0001Z" }, claimed_at: "2026-09-27T18:30:00.0001Z" }), "validation_failed"],
  ["fractional lease expiry", () => validateLeaseTime("2026-09-27T18:30:00.0000Z", "2026-09-27T18:30:00.0001Z"), "work_expired"],
  ["invalid manual retry transition", () => { const value = structuredClone(fixtures.get("publication-retry-trace.json")); value.manual_retry.next_attempt_count = 999; value.manual_retry.reentry_state = "acknowledged"; validateRetryTrace(value, contract); }, "validation_failed"],
  ["invalid successful retry attempt", () => { const value = structuredClone(fixtures.get("publication-retry-trace.json")); value.successful_retry.attempt_count = 999; validateRetryTrace(value, contract); }, "validation_failed"],
  ["invalid terminal retry attempt", () => { const value = structuredClone(fixtures.get("publication-retry-trace.json")); value.terminal_failure.attempt_count = contract.publication_work.maximum_total_attempts + 1; validateRetryTrace(value, contract); }, "validation_failed"],
  ["zero terminal retry attempt", () => { const value = structuredClone(fixtures.get("publication-retry-trace.json")); value.terminal_failure.attempt_count = 0; validateRetryTrace(value, contract); }, "validation_failed"],
  ["fractional terminal retry attempt", () => { const value = structuredClone(fixtures.get("publication-retry-trace.json")); value.terminal_failure.attempt_count = 1.5; validateRetryTrace(value, contract); }, "validation_failed"],
  ["observation scope cannot mutate", () => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: validEntitlement.forum_id, at: "2026-09-28T00:00:00Z", state: "active", scope: "observe_health", mutation: true }), "scope_denied"],
  ["pending entitlement cannot mutate", () => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: validEntitlement.forum_id, at: "2026-09-28T00:00:00Z", state: "pending_enrollment", scope: "retry_retryable_work", mutation: true }), "scope_denied"],
  ["expired entitlement state", () => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: validEntitlement.forum_id, at: "2026-09-28T00:00:00Z", state: "expired", scope: "retry_retryable_work", mutation: true }), "entitlement_expired"],
  ["invalid entitlement evaluation time", () => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: validEntitlement.forum_id, at: "not-a-time", state: "active", scope: "retry_retryable_work", mutation: true }), "malformed_value"],
  ["tampered empty scopes verify before scope", () => validateOperatorEntitlement({ ...structuredClone(validEntitlement), scopes: [] }, operator, trust), "entitlement_invalid_signature"],
  ["approval missing operation hash", () => { const context = structuredClone(approvedOperationContext); delete context.operationSha256; delete context.customerApproval.operationSha256; validateOperatorEntitlement(approvalEntitlement, operator, approvalTrust, context); }, "scope_denied"],
  ["approval mismatched operation hash", () => { const context = structuredClone(approvedOperationContext); context.customerApproval.operationSha256 = "6".repeat(64); validateOperatorEntitlement(approvalEntitlement, operator, approvalTrust, context); }, "scope_denied"],
  ["approval mismatched proposal", () => { const context = structuredClone(approvedOperationContext); context.customerApproval.proposalId = "proposal:other"; validateOperatorEntitlement(approvalEntitlement, operator, approvalTrust, context); }, "scope_denied"],
  ["grace non-observation scope", () => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: validEntitlement.forum_id, at: "2027-09-28T00:00:00Z", state: "grace_read_only", scope: "retry_retryable_work", mutation: true }), "scope_denied"],
  ["grace string mutation flag", () => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: validEntitlement.forum_id, at: "2027-09-28T00:00:00Z", state: "grace_read_only", scope: "observe_health", mutation: "true" }), "validation_failed"],
  ["operator false execution context", () => validateOperatorEntitlement(approvalEntitlement, operator, approvalTrust, false), "validation_failed"],
  ["operator numeric execution context", () => validateOperatorEntitlement(approvalEntitlement, operator, approvalTrust, 0), "validation_failed"],
  ["operator string execution context", () => validateOperatorEntitlement(approvalEntitlement, operator, approvalTrust, ""), "validation_failed"],
  ["operator array execution context", () => validateOperatorEntitlement(approvalEntitlement, operator, approvalTrust, []), "validation_failed"],
  ["operator null execution context", () => validateOperatorEntitlement(approvalEntitlement, operator, approvalTrust, null), "validation_failed"],
  ["operator lifetime fractional overage", () => { const value = resignApprovalEntitlement({ ...approvalEntitlement, expires_at: "2027-09-27T18:00:00.0001Z", grace_until: "2027-10-04T18:00:00.0001Z" }); validateOperatorEntitlement(value, operator, approvalTrust, approvedOperationContext); }, "validation_failed"],
  ["operator grace fractional overage", () => { const value = resignApprovalEntitlement({ ...approvalEntitlement, grace_until: "2027-10-04T18:00:00.0001Z" }); validateOperatorEntitlement(value, operator, approvalTrust, approvedOperationContext); }, "validation_failed"],
  ["static trace correlation mismatch", () => validateCorrelationExchange({ request_header: "request-correlation", request_body: "request-correlation", response_header: "response-correlation", response_body: "response-correlation" }, contract), "validation_failed"],
  ["failure leaks lease token", () => { const value = structuredClone(fixtures.get("publication-failure.json")); value.error_detail = `failure ${value.lease_token}`; validateFailure(value, contract); }, "secret_exposure"],
  ["excerpt plain text read more", () => { const value = structuredClone(baseExcerpt); value.content_html = `Excerpt Read More ${value.canonical_url}`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt nesting depth over limit", () => { const value = structuredClone(baseExcerpt); value.content_html = `${"<div>".repeat(contract.resolve.field_rules.excerpt_html_complexity.maximum_depth + 1)}body${"</div>".repeat(contract.resolve.field_rules.excerpt_html_complexity.maximum_depth + 1)}<p>This is a bounded excerpt.</p><p><a href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt element count over limit", () => { const value = structuredClone(baseExcerpt); value.content_html = `${"<span></span>".repeat(contract.resolve.field_rules.excerpt_html_complexity.maximum_elements - 2)}<p>This is a bounded excerpt.</p><p><a href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt forbidden style element", () => { const value = structuredClone(baseExcerpt); value.content_html = `<style>p{display:none}</style><p>This is a bounded excerpt.</p><p><a href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt forbidden stylesheet link", () => { const value = structuredClone(baseExcerpt); value.content_html = `<link rel="stylesheet" href="https://example.invalid/a.css"><p>This is a bounded excerpt.</p><p><a href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt forbidden script element", () => { const value = structuredClone(baseExcerpt); value.content_html = `<script>void 0</script><p>This is a bounded excerpt.</p><p><a href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt forbidden base element", () => { const value = structuredClone(baseExcerpt); value.content_html = `<base href="https://wrong.example/"><p>This is a bounded excerpt.</p><p><a href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt notice attribute", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p class="notice">This is a bounded excerpt.</p><p><a href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt notice nested markup", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>This is a bounded <strong>excerpt</strong>.</p><p><a href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt Read More paragraph attribute", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>This is a bounded excerpt.</p><p class="link"><a href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt Read More extra link attribute", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>This is a bounded excerpt.</p><p><a rel="external" href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt Read More nested markup", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>This is a bounded excerpt.</p><p><a href="${value.canonical_url}"><strong>Read More</strong></a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt Read More extra child", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>This is a bounded excerpt.</p><p><a href="${value.canonical_url}">Read More</a><span>extra</span></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt Read More wrong case", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>This is a bounded excerpt.</p><p><a href="${value.canonical_url}">Read more</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt comment-only anchor", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><!-- <a href="${value.canonical_url}">Read More</a> -->`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt data-href only", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><p><a data-href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt wrong href with canonical data-href", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><p><a href="https://wrong.example/" data-href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt template-only link", () => { const value = structuredClone(baseExcerpt); value.content_html = `<template><p>Excerpt only.</p><a href="${value.canonical_url}">Read More</a></template>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt textarea anchor text", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><textarea><a href="${value.canonical_url}">Read More</a></textarea>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt script-comment anchor", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><script>/* <a href="${value.canonical_url}">Read More</a> */</script>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt hidden link", () => { const value = structuredClone(baseExcerpt); value.content_html = `<div hidden><p>Excerpt only.</p><a href="${value.canonical_url}">Read More</a></div>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt duplicate href", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a href="https://wrong.example/" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt self-closing template trap", () => { const value = structuredClone(baseExcerpt); value.content_html = `<template/><p>Excerpt only.</p><a href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt self-closing hidden div trap", () => { const value = structuredClone(baseExcerpt); value.content_html = `<div hidden/><p>Excerpt only.</p><a href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt self-closing textarea trap", () => { const value = structuredClone(baseExcerpt); value.content_html = `<textarea/><p>Excerpt only.</p><a href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt spaced tag trap", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p>< a href="${value.canonical_url}">Read More</ a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt commented display none", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="display:/**/none" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt commented visibility hidden", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="visibility:/**/hidden" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt closed dialog link", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><dialog><a href="${value.canonical_url}">Read More</a></dialog>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt closed details body link", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><details><summary>More</summary><a href="${value.canonical_url}">Read More</a></details>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt escaped display property", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="d\\69splay:none" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt escaped display value", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="display:\\6e one" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt spaced important", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="display:none ! important" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt zero opacity", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="opacity:0" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt zero-percent opacity", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="opacity:0%" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt exponent-zero opacity", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="opacity:0e0" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt negative opacity", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="opacity:-1" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt calculated-zero opacity", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="opacity:calc(1 - 1)" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt invalid display cannot override none", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="display:none;display:banana" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt quoted custom-property semicolon", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><a style="display:none;--x:';display:block;'" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt closed popover link", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><div popover><a href="${value.canonical_url}">Read More</a></div>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt datalist link", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><datalist><a href="${value.canonical_url}">Read More</a></datalist>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt closed details direct notice", () => { const value = structuredClone(baseExcerpt); value.content_html = `<details>This is a bounded excerpt.<summary><a href="${value.canonical_url}">Read More</a></summary></details>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt stylesheet-hidden link", () => { const value = structuredClone(baseExcerpt); value.content_html = `<style>.canonical-link{display:none}</style><p>Excerpt only.</p><a class="canonical-link" href="${value.canonical_url}">Read More</a>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt SVG-hidden HTML link", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><svg display="none"><foreignObject><a xmlns="http://www.w3.org/1999/xhtml" href="${value.canonical_url}">Read More</a></foreignObject></svg>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt MathML anchor", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><math><a href="${value.canonical_url}">Read More</a></math>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt iframe anchor text", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><iframe><a href="${value.canonical_url}">Read More</a></iframe>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt xmp anchor text", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><xmp><a href="${value.canonical_url}">Read More</a></xmp>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["acknowledgement response foreign synchronized work", () => { const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").synchronized); response.work_id = `dbw_${"9".repeat(32)}`; validateAcknowledgementResponse(response, contract, { work: claimedWorkFixture.publication_work[0], acknowledgement: fixtures.get("publication-acknowledgement-static-pending.json"), destination_mode: "static" }); }, "identity_conflict"],
  ["acknowledgement response foreign deployed work", () => { const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").deployed); response.work_id = `dbw_${"9".repeat(32)}`; validateAcknowledgementResponse(response, contract, { work: claimedWorkFixture.publication_work[0], acknowledgement: fixtures.get("publication-acknowledgement-static-deployed.json"), destination_mode: "static" }); }, "identity_conflict"],
  ["acknowledgement response foreign verified work", () => { const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").verified); response.work_id = `dbw_${"9".repeat(32)}`; validateAcknowledgementResponse(response, contract, { work: claimedWorkFixture.publication_work[0], acknowledgement: fixtures.get("publication-acknowledgement.json"), destination_mode: "static" }); }, "identity_conflict"],
  ["acknowledgement response wrong terminal stage", () => { const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").verified); response.accepted_stage = "synchronized"; validateAcknowledgementResponse(response, contract, { work: claimedWorkFixture.publication_work[0], acknowledgement: fixtures.get("publication-acknowledgement.json"), destination_mode: "static" }); }, "stage_conflict"],
  ["acknowledgement dynamic response foreign work", () => { const trace = fixtures.get("publication-dynamic-trace.json"); const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").dynamic); response.work_id = `dbw_${"9".repeat(32)}`; validateAcknowledgementResponse(response, contract, { work: trace.work, acknowledgement: fixtures.get(trace.acknowledgement), destination_mode: "dynamic" }); }, "identity_conflict"],
  ...["resource_id", "destination_policy_id", "action", "source_revision", "source_revision_sequence", "policy_revision", "lease_token", "stage_token"].map((field) => [
    `dynamic acknowledgement foreign ${field}`,
    () => {
      const trace = fixtures.get("publication-dynamic-trace.json");
      const acknowledgement = structuredClone(fixtures.get(trace.acknowledgement));
      const replacements = {
        resource_id: "d4965d46-e657-4af4-af47-6439e544eeb7",
        destination_policy_id: "destination:ghost:foreign:1",
        action: "update",
        source_revision: "post:501:version:foreign",
        source_revision_sequence: 3,
        policy_revision: "policy:foreign",
        lease_token: "a".repeat(64),
        stage_token: "a".repeat(64),
      };
      acknowledgement[field] = replacements[field];
      validateAcknowledgementExchange(trace.work, acknowledgement, fixtures.get("publication-acknowledgement-responses.json")[trace.response_key], contract, "leased", {
        claimed_at: trace.claimed_at,
        received_at: trace.received_at,
        destination_mode: "dynamic",
      });
    },
    ["lease_token"].includes(field) ? "reconciliation_required" : field === "stage_token" ? "stage_conflict" : ["source_revision", "source_revision_sequence", "policy_revision"].includes(field) ? "revision_conflict" : "identity_conflict",
  ]),
  ["acknowledgement premature static terminal response", () => { const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").dynamic); response.work_id = claimedWorkFixture.publication_work[0].work_id; validateAcknowledgementResponse(response, contract, { work: claimedWorkFixture.publication_work[0], acknowledgement: fixtures.get("publication-acknowledgement-static-pending.json"), destination_mode: "static" }); }, "stage_conflict"],
  ["acknowledgement inappropriate dynamic nonterminal response", () => { const trace = fixtures.get("publication-dynamic-trace.json"); const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").synchronized); response.work_id = trace.work.work_id; response.correlation_id = fixtures.get(trace.acknowledgement).correlation_id; validateAcknowledgementResponse(response, contract, { work: trace.work, acknowledgement: fixtures.get(trace.acknowledgement), destination_mode: "dynamic" }); }, "stage_conflict"],
  ["static destination cannot claim dynamic terminal state", () => { const acknowledgement = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); acknowledgement.deployment_state = "not_required"; acknowledgement.verification_state = "not_required"; const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").dynamic); response.work_id = claimedWorkFixture.publication_work[0].work_id; response.correlation_id = acknowledgement.correlation_id; validateAcknowledgementExchange(claimedWorkFixture.publication_work[0], acknowledgement, response, contract, "leased", { ...acknowledgementContext, destination_mode: "static" }); }, "stage_conflict"],
  ["dynamic destination cannot claim static pending state", () => { const trace = fixtures.get("publication-dynamic-trace.json"); const acknowledgement = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); acknowledgement.resource_id = trace.work.resource_id; acknowledgement.destination_policy_id = trace.work.destination_policy_id; acknowledgement.action = trace.work.action; acknowledgement.source_revision = trace.work.source_revision; acknowledgement.source_revision_sequence = trace.work.source_revision_sequence; acknowledgement.policy_revision = trace.work.policy_revision; acknowledgement.lease_token = trace.work.lease_token; acknowledgement.stage_token = trace.work.stage_token; acknowledgement.correlation_id = fixtures.get(trace.acknowledgement).correlation_id; const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").synchronized); response.work_id = trace.work.work_id; response.correlation_id = acknowledgement.correlation_id; validateAcknowledgementExchange(trace.work, acknowledgement, response, contract, "leased", { claimed_at: trace.claimed_at, received_at: trace.received_at, destination_mode: "dynamic" }); }, "stage_conflict"],
  ["acknowledgement exchange missing authoritative destination mode", () => { const trace = fixtures.get("publication-dynamic-trace.json"); validateAcknowledgementExchange(trace.work, fixtures.get(trace.acknowledgement), fixtures.get("publication-acknowledgement-responses.json")[trace.response_key], contract, "leased", { claimed_at: trace.claimed_at, received_at: trace.received_at }); }, "validation_failed"],
  ["acknowledgement exchange malformed authoritative destination mode", () => { const trace = fixtures.get("publication-dynamic-trace.json"); validateAcknowledgementExchange(trace.work, fixtures.get(trace.acknowledgement), fixtures.get("publication-acknowledgement-responses.json")[trace.response_key], contract, "leased", { claimed_at: trace.claimed_at, received_at: trace.received_at, destination_mode: "unknown" }); }, "validation_failed"],
  ["existing topic rounded fractional token", () => validateResolveRecord(resolveWithExistingTopicToken("9007199254740992.5"), contract), "validation_failed"],
  ...["1.0000000000000001", "0.99999999999999999", "1.0000000000000001e0"].map((token) => [
    `existing topic nonintegral token ${token}`,
    () => validateResolveRecord(resolveWithExistingTopicToken(token), contract),
    "validation_failed",
  ]),
  ["existing topic exceeds signed 64-bit range", () => validateResolveRecord(resolveWithExistingTopicToken("9223372036854775808"), contract), "validation_failed"],
  ["protocol JSON duplicate member", () => parseProtocolJson('{"provider_name":"first","provider_name":"second"}'), "invalid_json"],
  ["protocol JSON duplicate decoded member", () => parseProtocolJson('{"provider_name":"first","provider_\\u006eame":"second"}'), "invalid_json"],
  ...["\ud800", "\udc00"].map((surrogate) => [
    `operator signed unpaired surrogate ${surrogate.charCodeAt(0).toString(16)}`,
    () => {
      const value = { ...structuredClone(approvalEntitlement), provider_name: `Provider ${surrogate}` };
      validateOperatorEntitlement(signEntitlementWithUncheckedProviderName(value), operator, approvalTrust);
    },
    "entitlement_invalid_signature",
  ]),
  ...["\ud800", "\udc00"].flatMap((surrogate) => [
    [
      `protocol JSON unpaired surrogate value ${surrogate.charCodeAt(0).toString(16)}`,
      () => parseProtocolJson(JSON.stringify({ provider_name: `Provider ${surrogate}` })),
      "invalid_json",
    ],
    [
      `protocol JSON unpaired surrogate member ${surrogate.charCodeAt(0).toString(16)}`,
      () => parseProtocolJson(JSON.stringify({ [surrogate]: "value" })),
      "invalid_json",
    ],
  ]),
  ...[0xfdd0, 0xffff, 0x1fffe, 0x10ffff].map((codePoint) => [
    `protocol JSON Unicode noncharacter U+${codePoint.toString(16).toUpperCase()}`,
    () => parseProtocolJson(JSON.stringify({ provider_name: `Provider ${String.fromCodePoint(codePoint)}` })),
    "invalid_json",
  ]),
  ["protocol JSON Unicode noncharacter member name", () => parseProtocolJson(JSON.stringify({ [String.fromCodePoint(0xfdd0)]: "value" })), "invalid_json"],
  ...[0xfdd0, 0xffff, 0x1fffe, 0x10ffff].map((codePoint) => [
    `operator signed Unicode noncharacter U+${codePoint.toString(16).toUpperCase()}`,
    () => {
      const value = { ...structuredClone(approvalEntitlement), provider_name: `Provider ${String.fromCodePoint(codePoint)}` };
      validateOperatorEntitlement(signEntitlementWithUncheckedProviderName(value), operator, approvalTrust);
    },
    "entitlement_invalid_signature",
  ]),
  ...[null, false, 0, 123, {}].map((signature) => [
    `operator malformed signature type ${JSON.stringify(signature)}`,
    () => validateOperatorEntitlement({ ...structuredClone(validEntitlement), signature }, operator, trust),
    "entitlement_invalid_signature",
  ]),
  ["manual retry generation overflow", () => { const value = structuredClone(fixtures.get("publication-retry-trace.json")); value.manual_retry.from_retry_generation = Number.MAX_SAFE_INTEGER; value.manual_retry.to_retry_generation = Number.MAX_SAFE_INTEGER + 1; validateRetryTrace(value, contract); }, "validation_failed"],
  ["chunk set invalid UTF-8", () => { const content = Buffer.from([0xff]); const digest = createHash("sha256").update(content).digest("hex"); const descriptor = { source_revision: "revision:invalid-utf8", byte_length: 1, sha256: digest, chunk_count: 1 }; const chunks = [{ source_revision: descriptor.source_revision, chunk: 1, chunk_count: 1, decoded_bytes: 1, chunk_sha256: digest, content_base64: content.toString("base64"), correlation_id: "invalid-utf8-01" }]; validateChunkSet(descriptor, chunks, contract); }, "integrity_failed"],
  ["package version mismatch", () => validateRepositoryIdentity({ ...packageMetadata, version: "0.2.0-alpha.20" }, contract, operator), "contract_version_mismatch"],
  ["operator contract version mismatch", () => validateRepositoryIdentity(packageMetadata, contract, { ...operator, version: "0.2.0-alpha.20" }), "contract_version_mismatch"],
  ["authentication header version mismatch", () => { const value = structuredClone(contract); value.authentication.contract_header_value = "0.2.0-alpha.20"; validateRepositoryIdentity(packageMetadata, value, operator); }, "contract_version_mismatch"],
];
for (const [name, operation, code] of mutationCases) {
  assert.throws(operation, (error) => error instanceof ProtocolError && error.code === code, `mutation ${name} must fail with ${code}`);
}

const validatorSource = await readFile(path.join(root, "tests", "protocol-validation.mjs"), "utf8");
const parse5Url = pathToFileURL(path.join(root, "node_modules", "parse5", "dist", "index.js")).href;
async function loadValidatorMutation(label, search, replacement) {
  assert.equal(validatorSource.split(search).length, 2, `${label} mutation target must occur exactly once`);
  const source = validatorSource
    .replace('from "parse5";', `from "${parse5Url}";`)
    .replace(search, replacement);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${encodeURIComponent(label)}`);
}

const chronologyMutant = await loadValidatorMutation(
  "synchronization-before-claim-guard",
  ' || compareTimestamps(acknowledgement.synchronized_at, context.claimed_at, "synchronized_at", "claimed_at") < 0',
  "",
);
const isolatedPreClaimAcknowledgement = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json"));
isolatedPreClaimAcknowledgement.synchronized_at = "2026-09-27T18:29:00Z";
assert.doesNotThrow(() => chronologyMutant.validateAcknowledgementIdentity(
  claimedWorkFixture.publication_work[0],
  isolatedPreClaimAcknowledgement,
  "leased",
  { received_at: "2026-09-27T18:31:00Z", claimed_at: claimedWorkFixture.claimed_at, destination_mode: "static" },
), "isolated chronology regression must detect removal of only the synchronization-before-claim guard");

const responseBindingMutant = await loadValidatorMutation(
  "acknowledgement-response-work-binding",
  'if (value.work_id !== context.work.work_id) fail("identity_conflict", "acknowledgement response names another work item");',
  "",
);
const foreignVerifiedResponse = structuredClone(fixtures.get("publication-acknowledgement-responses.json").verified);
foreignVerifiedResponse.work_id = `dbw_${"9".repeat(32)}`;
assert.doesNotThrow(() => responseBindingMutant.validateAcknowledgementResponse(foreignVerifiedResponse, contract, {
  work: claimedWorkFixture.publication_work[0],
  acknowledgement: fixtures.get("publication-acknowledgement.json"),
  destination_mode: "static",
}), "foreign-work regression must detect removal of the response work binding");

const responseTerminalMutant = await loadValidatorMutation(
  "acknowledgement-response-terminal-binding",
  'if (value.terminal !== expectedTerminal) fail("stage_conflict", "acknowledgement response terminal state does not match request");',
  "",
);
const prematureStaticTerminal = structuredClone(fixtures.get("publication-acknowledgement-responses.json").dynamic);
prematureStaticTerminal.work_id = claimedWorkFixture.publication_work[0].work_id;
assert.doesNotThrow(() => responseTerminalMutant.validateAcknowledgementResponse(prematureStaticTerminal, contract, {
  work: claimedWorkFixture.publication_work[0],
  acknowledgement: fixtures.get("publication-acknowledgement-static-pending.json"),
  destination_mode: "static",
}), "premature-static-terminal regression must detect removal of the response terminal binding");

const dynamicAuthorityMutant = await loadValidatorMutation(
  "dynamic-acknowledgement-authority-binding",
  "  validateAcknowledgementIdentity(work, acknowledgement, state, acceptanceContext);",
  "",
);
const dynamicTrace = fixtures.get("publication-dynamic-trace.json");
const foreignDynamicAcknowledgement = structuredClone(fixtures.get(dynamicTrace.acknowledgement));
foreignDynamicAcknowledgement.resource_id = "d4965d46-e657-4af4-af47-6439e544eeb7";
assert.doesNotThrow(() => dynamicAuthorityMutant.validateAcknowledgementExchange(
  dynamicTrace.work,
  foreignDynamicAcknowledgement,
  fixtures.get("publication-acknowledgement-responses.json")[dynamicTrace.response_key],
  contract,
  "leased",
  { claimed_at: dynamicTrace.claimed_at, received_at: dynamicTrace.received_at, destination_mode: "dynamic" },
), "dynamic authority regression must detect removal of the full acknowledgement/work binding");

const excerptStructureMutant = await loadValidatorMutation(
  "excerpt-exact-read-more-text",
  'if (normalizeText(link.childNodes.map((node) => node.value).join("")) !== "Read More") fail("validation_failed", "Read More link has invalid text");',
  "",
);
const wrongCaseExcerpt = structuredClone(baseExcerpt);
wrongCaseExcerpt.content_html = `<p>This is a bounded excerpt.</p><p><a href="${wrongCaseExcerpt.canonical_url}">Read more</a></p>`;
assert.doesNotThrow(
  () => excerptStructureMutant.validateResolveRecord(wrongCaseExcerpt, contract),
  "excerpt structural regression must detect removal of the exact Read More text guard",
);

const zeroExpansionMutant = await loadValidatorMutation(
  "exact-integer-zero-short-circuit",
  "  if (/^0+$/.test(digits)) return 0n;",
  "",
);
const repeatBeforeZeroMutation = String.prototype.repeat;
try {
  String.prototype.repeat = function detectedIntegerExpansion(count) {
    throw new Error(`source reversion attempted ${count}-character integer expansion`);
  };
  assert.throws(
    () => zeroExpansionMutant.parseProtocolJson('{"existing_topic_id":0e1000000}'),
    (error) => error instanceof zeroExpansionMutant.ProtocolError && error.code === "invalid_json",
    "integer regression must detect removal of the all-zero coefficient short circuit",
  );
} finally {
  String.prototype.repeat = repeatBeforeZeroMutation;
}

const catalogIdentifierMutant = await loadValidatorMutation(
  "catalog-identifier-byte-bound",
  "  nonblank(value, contract.common.opaque_identifier_maximum_bytes, name);",
  "  requiredString(value, name);",
);
const overlongCatalogIdentifier = structuredClone(fixtures.get("platform-catalog-authors.json"));
overlongCatalogIdentifier.items[0].id = "x".repeat(contract.common.opaque_identifier_maximum_bytes + 1);
assert.doesNotThrow(
  () => catalogIdentifierMutant.validateCatalogSegment(overlongCatalogIdentifier, contract),
  "catalog regression must detect removal of the common opaque-identifier byte bound",
);

const unicodeNoncharacterMutant = await loadValidatorMutation(
  "I-JSON-Unicode-noncharacter-guard",
  '    if ((codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xfffe) === 0xfffe) fail(code, `${name} contains a Unicode noncharacter`);',
  "",
);
const signedNoncharacterEntitlement = signEntitlementWithUncheckedProviderName({
  ...structuredClone(approvalEntitlement),
  provider_name: `Provider ${String.fromCodePoint(0xfdd0)}`,
});
assert.doesNotThrow(
  () => unicodeNoncharacterMutant.validateOperatorEntitlement(signedNoncharacterEntitlement, operator, approvalTrust),
  "Unicode regression must detect removal of the I-JSON noncharacter guard with a matching signature",
);

const rawJsonByteGuardMutant = await loadValidatorMutation(
  "raw-endpoint-JSON-byte-guard",
  '  if (bytes(text) > maximum) fail("validation_failed", `${name} exceeds maximum_json_bytes`);',
  "",
);
assert.doesNotThrow(
  () => rawJsonByteGuardMutant.validateCatalogSegmentText(jsonTextAtSize(fixtures.get("platform-catalog-authors.json"), contract.platform_catalog.maximum_json_bytes + 1), contract),
  "catalog GET regression must detect removal of the shared raw JSON byte guard",
);
assert.doesNotThrow(
  () => rawJsonByteGuardMutant.validateCatalogUpdateText(catalogRequestTextAtSize(contract.platform_catalog.maximum_json_bytes + 1), contract),
  "catalog PUT regression must detect removal of the shared raw JSON byte guard",
);
assert.doesNotThrow(
  () => rawJsonByteGuardMutant.validateErrorResponseText(jsonTextAtSize(fixtures.get("rejected-response.json"), contract.error_responses.maximum_json_bytes + 1), contract),
  "error-response regression must detect removal of the shared raw JSON byte guard",
);

const rawJsonByteGuardOrderMutant = await loadValidatorMutation(
  "raw-endpoint-JSON-byte-guard-order",
  '  if (bytes(text) > maximum) fail("validation_failed", `${name} exceeds maximum_json_bytes`);\n  const value = parseProtocolJson(text);',
  '  const value = parseProtocolJson(text);\n  if (bytes(text) > maximum) fail("validation_failed", `${name} exceeds maximum_json_bytes`);',
);
assert.throws(
  () => rawJsonByteGuardOrderMutant.validateCatalogSegmentText(`[${" ".repeat(contract.platform_catalog.maximum_json_bytes)}`, contract),
  (error) => error instanceof rawJsonByteGuardOrderMutant.ProtocolError && error.code === "invalid_json",
  "raw endpoint regression must detect moving the size guard after parsing",
);

const claimWorkPreflightOrderMutant = await loadValidatorMutation(
  "claim-work-preparse-byte-guard-order",
  '  const rawWorkItems = topLevelArrayElementTexts(text, "publication_work", contract.publication_work.maximum_json_bytes, contract.publication_work.claim.maximum_items);\n  if (rawWorkItems === null) fail("validation_failed", "claim response.publication_work is required");\n  validateJsonText(text);',
  '  validateJsonText(text);\n  const rawWorkItems = topLevelArrayElementTexts(text, "publication_work", contract.publication_work.maximum_json_bytes, contract.publication_work.claim.maximum_items);\n  if (rawWorkItems === null) fail("validation_failed", "claim response.publication_work is required");',
);
assert.throws(
  () => claimWorkPreflightOrderMutant.validateClaimResponseText(claimResponseWithRawWorkText("x".repeat(contract.publication_work.maximum_json_bytes + 1)), contract, fixtures.get("publication-work-claim-request.json")),
  (error) => error instanceof claimWorkPreflightOrderMutant.ProtocolError && error.code === "invalid_json",
  "claim work regression must detect parsing before the per-item raw byte preflight",
);

const claimWorkIncrementalBudgetRemovalMutant = await loadValidatorMutation(
  "claim-work-incremental-byte-budget-removal",
  '      if (used > maximum) fail("validation_failed", `${name} exceeds maximum_json_bytes`);',
  "",
);
assert.doesNotThrow(
  () => claimWorkIncrementalBudgetRemovalMutant.validateClaimResponseText(claimResponseWithRawWorkSize(contract.publication_work.maximum_json_bytes + 1), contract, fixtures.get("publication-work-claim-request.json")),
  "claim work regression must detect removal of the incremental raw-byte barrier",
);

const claimWorkIncrementalBudgetBypassMutant = await loadValidatorMutation(
  "claim-work-incremental-byte-budget-bypass",
  '        index = skipRawJsonValue(text, index, budget);\n        index = skipJsonWhitespace(text, index, budget);',
  '        index = skipRawJsonValue(text, index);\n        index = skipJsonWhitespace(text, index);',
);
assert.doesNotThrow(
  () => claimWorkIncrementalBudgetBypassMutant.validateClaimResponseText(claimResponseWithRawWorkSize(contract.publication_work.maximum_json_bytes + 1), contract, fixtures.get("publication-work-claim-request.json")),
  "claim work regression must detect delaying the byte barrier until after lexical traversal",
);

const acknowledgementModeAuthorityMutant = await loadValidatorMutation(
  "acknowledgement-authoritative-destination-mode",
  '  validateAcknowledgementIdentity(work, acknowledgement, state, acceptanceContext);\n  validateAcknowledgementResponse(response, contract, { work, acknowledgement, destination_mode: acceptanceContext.destination_mode });',
  '  const claimantControlledContext = { ...acceptanceContext, destination_mode: "dynamic" };\n  validateAcknowledgementIdentity(work, acknowledgement, state, claimantControlledContext);\n  validateAcknowledgementResponse(response, contract, { work, acknowledgement, destination_mode: claimantControlledContext.destination_mode });',
);
const downgradedStaticAcknowledgement = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json"));
downgradedStaticAcknowledgement.deployment_state = "not_required";
downgradedStaticAcknowledgement.verification_state = "not_required";
const downgradedStaticResponse = structuredClone(fixtures.get("publication-acknowledgement-responses.json").dynamic);
downgradedStaticResponse.work_id = claimedWorkFixture.publication_work[0].work_id;
downgradedStaticResponse.correlation_id = downgradedStaticAcknowledgement.correlation_id;
assert.doesNotThrow(
  () => acknowledgementModeAuthorityMutant.validateAcknowledgementExchange(
    claimedWorkFixture.publication_work[0],
    downgradedStaticAcknowledgement,
    downgradedStaticResponse,
    contract,
    "leased",
    acknowledgementContext,
  ),
  "acknowledgement regression must detect replacement of authoritative static mode with claimant-controlled dynamic mode",
);

const catalogAggregateMutant = await loadValidatorMutation(
  "catalog-compact-aggregate-byte-guard",
  '  if (bytes(JSON.stringify(value)) > contract.platform_catalog.maximum_json_bytes) fail("validation_failed", "catalog request exceeds maximum_json_bytes");',
  "",
);
assert.doesNotThrow(
  () => catalogAggregateMutant.validateCatalogUpdate(fullyPopulatedCatalogUpdate(), contract),
  "catalog aggregate regression must detect removal of the compact-object byte guard with individually valid fields",
);

const highSurrogateMutant = await loadValidatorMutation(
  "I-JSON-high-surrogate-guard",
  '      if (!(next >= 0xdc00 && next <= 0xdfff)) fail(code, `${name} contains an unpaired surrogate`);',
  "",
);
const signedHighSurrogateEntitlement = signEntitlementWithUncheckedProviderName({
  ...structuredClone(approvalEntitlement),
  provider_name: "Provider \ud800",
});
assert.doesNotThrow(
  () => highSurrogateMutant.validateOperatorEntitlement(signedHighSurrogateEntitlement, operator, approvalTrust),
  "Unicode regression must detect removal of the high-surrogate guard with a matching signature",
);

const lowSurrogateMutant = await loadValidatorMutation(
  "I-JSON-low-surrogate-guard",
  '    } else if (unit >= 0xdc00 && unit <= 0xdfff) {\n      fail(code, `${name} contains an unpaired surrogate`);\n    }',
  "    }",
);
const signedLowSurrogateEntitlement = signEntitlementWithUncheckedProviderName({
  ...structuredClone(approvalEntitlement),
  provider_name: "Provider \udc00",
});
assert.doesNotThrow(
  () => lowSurrogateMutant.validateOperatorEntitlement(signedLowSurrogateEntitlement, operator, approvalTrust),
  "Unicode regression must detect removal of the low-surrogate guard with a matching signature",
);

const chunkSetAlwaysRejectsMutant = await loadValidatorMutation(
  "chunk-set-positive-reassembly",
  "export function validateChunkSet(descriptor, chunks, contract) {",
  'export function validateChunkSet(descriptor, chunks, contract) {\n  fail("integrity_failed");',
);
assert.throws(
  () => chunkSetAlwaysRejectsMutant.validateChunkSet(validSplitUtf8Descriptor, validSplitUtf8Chunks, contract),
  (error) => error instanceof chunkSetAlwaysRejectsMutant.ProtocolError && error.code === "integrity_failed",
  "chunk-set regression must require successful complete reassembly",
);

const activeText = [
  JSON.stringify(contract),
  JSON.stringify(operator),
  await readFile(path.join(root, "README.md"), "utf8"),
  await readFile(path.join(root, "MIGRATION.md"), "utf8"),
  ...positiveNames.map((name) => JSON.stringify(fixtures.get(name))),
].join("\n");
assert.doesNotMatch(activeText, /fullInteractive/);
assert.doesNotMatch(activeText, /Repeal OBBBA Forum|obbba-/i);

console.log(`Conformance validated ${positiveNames.length} positive fixtures, ${negativeNames.length} exact-error negative fixtures, ${mutationCases.length} mutation classes, and 18 targeted source-reversion probes for ${contract.version}.`);
