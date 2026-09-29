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
  validateAcknowledgementResponse,
  validateAcknowledgementIdentity,
  validateAuthenticationHeaders,
  validateCatalogSegment,
  validateCatalogCursor,
  validateCatalogUpdate,
  validateClaimRequest,
  validateClaimResponse,
  validateChunk,
  validateChunkSet,
  validateConnectionCapability,
  validateContractHeader,
  validateCorrelationExchange,
  validateCursorSnapshot,
  validateCutoverManifest,
  validateCutoverRehearsal,
  validateDestinationCollision,
  validateDirection,
  validateEntitlementTime,
  validateErrorResponse,
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
  validateStageTransition,
  validateUrlProof,
  validateUrlProofResponse,
  validateWork,
} from "./protocol-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = async (relative) => parseProtocolJson(await readFile(path.join(root, relative), "utf8"));
const contract = await load("contract.json");
const operator = await load("operator-service-contract.json");
const packageMetadata = await load("package.json");
const positiveDirectory = path.join(root, "fixtures");
const negativeDirectory = path.join(positiveDirectory, "invalid");
const positiveNames = (await readdir(positiveDirectory)).filter((name) => name.endsWith(".json")).sort();
const negativeNames = (await readdir(negativeDirectory)).filter((name) => name.endsWith(".json")).sort();
const fixtures = new Map();
for (const name of positiveNames) fixtures.set(name, await load(`fixtures/${name}`));
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
const claimedWorkFixture = fixtures.get("publication-work-claim.json");
const renewalContext = {
  work: claimedWorkFixture.publication_work[0],
  state: "leased",
  claimed_at: claimedWorkFixture.claimed_at,
  request_received_at: "2026-09-27T18:34:00Z",
  current_total_lease_seconds: 300,
};
const acknowledgementContext = { received_at: "2026-09-27T18:31:00Z", claimed_at: claimedWorkFixture.claimed_at };
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
  "connection-capability.json": (value) => validateConnectionCapability(value, contract),
  "connection-capability-to-discourse.json": (value) => validateConnectionCapability(value, contract),
  "correlation-roundtrip.json": (value) => { for (const transaction of value.transactions) { const exchange = structuredClone(transaction); delete exchange.route; validateCorrelationExchange(exchange, contract); } },
  "created-response.json": (value) => validateResolveResponse(value, contract.resolve.success_response_required_fields, contract),
  "resolved-response.json": (value) => validateResolveResponse(value, contract.resolve.success_response_required_fields, contract),
  "reconciliation-required-response.json": (value) => validateResolveResponse(value, contract.resolve.reconciliation_response_required_fields, contract),
  "rejected-response.json": (value) => validateErrorResponse(value, contract),
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
  "source-detail-inline.json": (value) => validateSourceDetail(value, contract),
  "source-detail-chunked.json": (value) => validateSourceDetail(value, contract),
  "network-source-detail.json": (value) => validateSourceDetail(value, contract),
  "network-spoke-source-detail.json": (value) => validateSourceDetail(value, contract),
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
  "publication-work-claim.json": (value) => validateClaimResponse(value, contract, fixtures.get("publication-work-claim-request.json")),
  "publication-work-restore.json": (value) => validateClaimResponse(value, contract),
  "publication-work-withdrawal.json": (value) => validateClaimResponse(value, contract),
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
    validateAcknowledgement(acknowledgement, contract);
    validateAcknowledgementResponse(response, contract, { work: { work_id: value.work_id }, acknowledgement });
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
    validateAcknowledgementResponse(responses.synchronized, contract, { work: claimedWork, acknowledgement: synchronized });
    validateCorrelationExchange({ request_header: synchronized.correlation_id, request_body: synchronized.correlation_id, response_header: responses.synchronized.correlation_id, response_body: responses.synchronized.correlation_id }, contract);
    validateStageTransition(synchronized, deployed, responses.synchronized);
    validateAcknowledgement(deployed, contract);
    validateAcknowledgementIdentity({ ...claimedWork, stage_token: responses.synchronized.next_stage_token }, deployed, "awaiting_deployment", { received_at: "2026-09-27T18:36:00Z" });
    validateAcknowledgementResponse(responses.deployed, contract, { work: claimedWork, acknowledgement: deployed });
    validateCorrelationExchange({ request_header: deployed.correlation_id, request_body: deployed.correlation_id, response_header: responses.deployed.correlation_id, response_body: responses.deployed.correlation_id }, contract);
    validateStageTransition(deployed, verified, responses.deployed);
    validateAcknowledgement(verified, contract);
    validateAcknowledgementIdentity({ ...claimedWork, stage_token: responses.deployed.next_stage_token }, verified, "awaiting_verification", { received_at: "2026-09-27T18:37:00Z" });
    validateAcknowledgementResponse(responses.verified, contract, { work: claimedWork, acknowledgement: verified });
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
  "platform-catalog-segment.json": (value) => validateCatalogSegment(value, contract),
  "platform-catalog-containers.json": (value) => validateCatalogSegment(value, contract),
  "platform-catalog-taxonomies.json": (value) => validateCatalogSegment(value, contract),
  "platform-catalog-terms.json": (value) => validateCatalogSegment(value, contract),
  "platform-catalog-authors.json": (value) => validateCatalogSegment(value, contract),
  "platform-catalog-native-limits.json": (value) => validateCatalogSegment(value, contract),
  "platform-catalog-update.json": (value) => validateCatalogUpdate(value, contract),
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
  positiveHandlers[name](fixtures.get(name));
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
const dynamicPreAcknowledgementRecord = structuredClone(preAcknowledgementRecord);
dynamicPreAcknowledgementRecord.bindings[0].deployment_state = "not_required";
dynamicPreAcknowledgementRecord.bindings[0].verification_state = "not_required";
validateRecordShow({ bridge_record: dynamicPreAcknowledgementRecord, correlation_id: "pre-ack-migration-dynamic-01" }, contract);

const formattedExcerpt = structuredClone(fixtures.get("to-discourse-excerpt-request.json").bridge_record);
formattedExcerpt.content_html = `<p>This is a bounded excerpt.</p><p><a href="${formattedExcerpt.canonical_url}"><strong>Read More</strong></a></p>`;
validateResolveRecord(formattedExcerpt, contract);
const entityExcerpt = structuredClone(formattedExcerpt);
entityExcerpt.canonical_url = "https://publisher.example/article/?first=1&second=2";
entityExcerpt.read_more_url = entityExcerpt.canonical_url;
entityExcerpt.content_html = '<p>This is a bounded excerpt.</p><p><a href="https://publisher.example/article/?first=1&amp;second=2">Read&#32;More</a></p>';
validateResolveRecord(entityExcerpt, contract);
const namedEntityExcerpt = structuredClone(formattedExcerpt);
namedEntityExcerpt.content_html = `<p>This is a bounded excerpt.</p><p><a href="${namedEntityExcerpt.canonical_url.replace(":", "&colon;")}">Read&ensp;More</a></p>`;
validateResolveRecord(namedEntityExcerpt, contract);
const optionalEndTagExcerpt = structuredClone(formattedExcerpt);
optionalEndTagExcerpt.content_html = `<p>This is a bounded excerpt.<p><a href="${optionalEndTagExcerpt.canonical_url}">Read More</a>`;
validateResolveRecord(optionalEndTagExcerpt, contract);
const cascadedVisibleExcerpt = structuredClone(formattedExcerpt);
cascadedVisibleExcerpt.content_html = `<p>This is a bounded excerpt.</p><p><a style="display:none;display:inline" href="${cascadedVisibleExcerpt.canonical_url}">Read More</a></p>`;
validateResolveRecord(cascadedVisibleExcerpt, contract);
const importantVisibleExcerpt = structuredClone(formattedExcerpt);
importantVisibleExcerpt.content_html = `<p>This is a bounded excerpt.</p><p><a style="display:none;display:inline !important" href="${importantVisibleExcerpt.canonical_url}">Read More</a></p>`;
validateResolveRecord(importantVisibleExcerpt, contract);
const inheritedVisibilityExcerpt = structuredClone(formattedExcerpt);
inheritedVisibilityExcerpt.content_html = `<div style="visibility:hidden"><p style="visibility:visible">This is a bounded excerpt. <a href="${inheritedVisibilityExcerpt.canonical_url}">Read More</a></p></div>`;
validateResolveRecord(inheritedVisibilityExcerpt, contract);
const restoredAnchorLabelExcerpt = structuredClone(formattedExcerpt);
restoredAnchorLabelExcerpt.content_html = `<p>This is a bounded excerpt.</p><a style="visibility:hidden" href="${restoredAnchorLabelExcerpt.canonical_url}"><span style="visibility:visible">Read More</span></a>`;
validateResolveRecord(restoredAnchorLabelExcerpt, contract);
const openDialogExcerpt = structuredClone(formattedExcerpt);
openDialogExcerpt.content_html = `<dialog open><p>This is a bounded excerpt.</p><a href="${openDialogExcerpt.canonical_url}">Read More</a></dialog>`;
validateResolveRecord(openDialogExcerpt, contract);
const summaryExcerpt = structuredClone(formattedExcerpt);
summaryExcerpt.content_html = `<details><summary>This is a bounded excerpt. <a href="${summaryExcerpt.canonical_url}">Read More</a></summary><p>Hidden detail.</p></details>`;
validateResolveRecord(summaryExcerpt, contract);
const deeplyNestedExcerpt = structuredClone(formattedExcerpt);
deeplyNestedExcerpt.content_html = `${"<div>".repeat(4000)}<p>This is a bounded excerpt.</p><a href="${deeplyNestedExcerpt.canonical_url}">Read More</a>${"</div>".repeat(4000)}`;
validateResolveRecord(deeplyNestedExcerpt, contract);
const resolveWithExistingTopicToken = (token) => {
  const envelope = { bridge_record: { ...structuredClone(fixtures.get("to-discourse-request.json").bridge_record), existing_topic_id: 1 } };
  const encoded = JSON.stringify(envelope).replace('"existing_topic_id":1', `"existing_topic_id":${token}`);
  return parseProtocolJson(encoded).bridge_record;
};
const adjacentLargeTopicIds = [resolveWithExistingTopicToken("9007199254740992"), resolveWithExistingTopicToken("9007199254740993")];
assert.notEqual(adjacentLargeTopicIds[0].existing_topic_id, adjacentLargeTopicIds[1].existing_topic_id);
for (const record of [...adjacentLargeTopicIds, resolveWithExistingTopicToken("9223372036854775807")]) validateResolveRecord(record, contract);

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

const restrictedCapability = structuredClone(fixtures.get("connection-capability.json"));
restrictedCapability.allowed_presentation_modes = ["interactive"];
validateConnectionCapability(restrictedCapability, contract);

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
  ["record index unknown field", () => validateRecordIndex({ ...structuredClone(fixtures.get("bridge-record-index.json")), unexpected: true }, contract), "unknown_field"],
  ["record show unknown field", () => validateRecordShow({ ...structuredClone(fixtures.get("from-discourse-record.json")), unexpected: true }, contract), "unknown_field"],
  ["inventory unknown field", () => validateInventory({ ...structuredClone(fixtures.get("source-inventory-page.json")), unexpected: true }, contract), "unknown_field"],
  ["source detail unknown field", () => validateSourceDetail({ ...structuredClone(fixtures.get("source-detail-inline.json")), unexpected: true }, contract), "unknown_field"],
  ["URL proof unknown field", () => validateUrlProofResponse({ ...structuredClone(fixtures.get("source-url-proof.json")), unexpected: true }, contract), "unknown_field"],
  ["revocation index unknown field", () => validateRevocationIndex({ ...structuredClone(fixtures.get("source-revocation-index.json")), unexpected: true }, contract), "unknown_field"],
  ["revocation detail unknown field", () => validateRevocationDetail({ ...structuredClone(fixtures.get("source-revocation.json")), unexpected: true }, contract), "unknown_field"],
  ["claim request unknown field", () => validateClaimRequest({ ...structuredClone(fixtures.get("publication-work-claim-request.json")), unexpected: true }, contract), "unknown_field"],
  ["claim response unknown field", () => validateClaimResponse({ ...structuredClone(fixtures.get("publication-work-claim.json")), unexpected: true }, contract), "unknown_field"],
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
  ["catalog request byte ceiling", () => { const value = structuredClone(fixtures.get("platform-catalog-update.json")); value.request.segments[0].items[0].name = "x".repeat(contract.platform_catalog.maximum_json_bytes); validateCatalogUpdate(value, contract); }, "validation_failed"],
  ["record index page ceiling", () => { const value = structuredClone(fixtures.get("bridge-record-index.json")); value.page = contract.records.maximum_page + 1; value.total_pages = value.page; validateRecordIndex(value, contract); }, "validation_failed"],
  ["operator audit malformed forum", () => validateOperatorAudit({ ...structuredClone(fixtures.get("operator-enrollment-audit.json")), forum_id: "invalid" }, operator), "validation_failed"],
  ["cutover null receiver schema", () => validateCutoverManifest({ ...structuredClone(fixtures.get("cutover-manifest.json")), receiver_schema: null }, contract), "validation_failed"],
  ["cutover rehearsal manifest mismatch", () => validateCutoverRehearsal({ ...structuredClone(fixtures.get("cutover-rehearsal.json")), manifest_id: "dbm_22222222222222222222222222222222" }, fixtures.get("cutover-manifest.json"), contract), "reconciliation_required"],
  ["cutover rehearsal artifact mismatch", () => { const manifest = structuredClone(fixtures.get("cutover-manifest.json")); manifest.adapter_protocol.sha256 = "f".repeat(64); validateCutoverRehearsal(fixtures.get("cutover-rehearsal.json"), manifest, contract); }, "reconciliation_required"],
  ["oversized error response", () => { const value = structuredClone(fixtures.get("rejected-response.json")); value.message = "x".repeat(contract.error_responses.maximum_json_bytes); validateErrorResponse(value, contract); }, "validation_failed"],
  ["capability invented direction", () => { const value = structuredClone(fixtures.get("connection-capability.json")); value.directions = ["delete_everything"]; validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability invalid authority metadata", () => { const value = structuredClone(fixtures.get("connection-capability.json")); value.lanes = [""]; value.catalog_required = "yes"; value.policy_revision = ""; value.supported_operations = ["resolve", "resolve"]; validateConnectionCapability(value, contract); }, "validation_failed"],
  ["capability malformed nested mapping", () => { const value = structuredClone(fixtures.get("connection-capability.json")); value.destination_policies[0].author_mapping.items = [null]; validateConnectionCapability(value, contract); }, "validation_failed"],
  ["catalog malformed nested item", () => { const value = structuredClone(fixtures.get("platform-catalog-update.json")); value.request.segments[0].items = [{ id: "", name: 123, available: "yes", unexpected: true }]; validateCatalogUpdate(value, contract); }, "unknown_field"],
  ["catalog response scope mismatch", () => { const value = structuredClone(fixtures.get("platform-catalog-update.json")); value.response.platform_profile = "wordpress"; validateCatalogUpdate(value, contract); }, "validation_failed"],
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
  ["synchronization before claim", () => { const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.synchronized_at = "2026-09-27T18:29:00Z"; validateAcknowledgementIdentity(fixtures.get("publication-work-claim.json").publication_work[0], ack, "leased", { received_at: "2026-09-27T18:31:00Z", claimed_at: claimedWorkFixture.claimed_at }); }, "validation_failed"],
  ["unissued next stage token", () => { const previous = fixtures.get("publication-acknowledgement-static-pending.json"); const next = structuredClone(fixtures.get("publication-acknowledgement-static-deployed.json")); next.stage_token = "a".repeat(64); validateStageTransition(previous, next, fixtures.get("publication-acknowledgement-responses.json").synchronized); }, "stage_conflict"],
  ["terminal dynamic acknowledgement advancement", () => validateStageTransition(fixtures.get("publication-acknowledgement-create.json"), fixtures.get("publication-acknowledgement-static-deployed.json"), { ...fixtures.get("publication-acknowledgement-responses.json").dynamic, terminal: false, next_stage_token: "3".repeat(64) }), "stage_conflict"],
  ["stage transition changed synchronized time", () => { const next = structuredClone(fixtures.get("publication-acknowledgement-static-deployed.json")); next.synchronized_at = "2026-09-27T18:31:01Z"; validateStageTransition(fixtures.get("publication-acknowledgement-static-pending.json"), next, fixtures.get("publication-acknowledgement-responses.json").synchronized); }, "identity_conflict"],
  ["stage transition changed deployed time", () => { const next = structuredClone(fixtures.get("publication-acknowledgement.json")); next.deployed_at = "2026-09-27T18:31:40Z"; validateStageTransition(fixtures.get("publication-acknowledgement-static-deployed.json"), next, fixtures.get("publication-acknowledgement-responses.json").deployed); }, "identity_conflict"],
  ["deployment before synchronization", () => { const value = structuredClone(fixtures.get("publication-acknowledgement-static-deployed.json")); value.deployed_at = "2026-09-27T18:30:59Z"; validateAcknowledgement(value, contract); }, "validation_failed"],
  ["verification before deployment", () => { const value = structuredClone(fixtures.get("publication-acknowledgement.json")); value.publicly_verified_at = "2026-09-27T18:31:29Z"; validateAcknowledgement(value, contract); }, "validation_failed"],
  ["deployment after receipt", () => validateAcknowledgementIdentity({ ...fixtures.get("publication-work-claim.json").publication_work[0], stage_token: fixtures.get("publication-acknowledgement-static-deployed.json").stage_token }, { ...fixtures.get("publication-acknowledgement-static-deployed.json"), deployed_at: "2026-09-27T18:36:30Z" }, "awaiting_deployment", { received_at: "2026-09-27T18:36:00Z" }), "validation_failed"],
  ["verification after receipt", () => validateAcknowledgementIdentity({ ...fixtures.get("publication-work-claim.json").publication_work[0], stage_token: fixtures.get("publication-acknowledgement.json").stage_token }, { ...fixtures.get("publication-acknowledgement.json"), publicly_verified_at: "2026-09-27T18:38:00Z" }, "awaiting_verification", { received_at: "2026-09-27T18:37:00Z" }), "validation_failed"],
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
  ["acknowledgement response foreign synchronized work", () => { const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").synchronized); response.work_id = `dbw_${"9".repeat(32)}`; validateAcknowledgementResponse(response, contract, { work: claimedWorkFixture.publication_work[0], acknowledgement: fixtures.get("publication-acknowledgement-static-pending.json") }); }, "identity_conflict"],
  ["acknowledgement response foreign deployed work", () => { const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").deployed); response.work_id = `dbw_${"9".repeat(32)}`; validateAcknowledgementResponse(response, contract, { work: claimedWorkFixture.publication_work[0], acknowledgement: fixtures.get("publication-acknowledgement-static-deployed.json") }); }, "identity_conflict"],
  ["acknowledgement response foreign verified work", () => { const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").verified); response.work_id = `dbw_${"9".repeat(32)}`; validateAcknowledgementResponse(response, contract, { work: claimedWorkFixture.publication_work[0], acknowledgement: fixtures.get("publication-acknowledgement.json") }); }, "identity_conflict"],
  ["acknowledgement response wrong terminal stage", () => { const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").verified); response.accepted_stage = "synchronized"; validateAcknowledgementResponse(response, contract, { work: claimedWorkFixture.publication_work[0], acknowledgement: fixtures.get("publication-acknowledgement.json") }); }, "stage_conflict"],
  ["acknowledgement dynamic response foreign work", () => { const trace = fixtures.get("publication-dynamic-trace.json"); const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").dynamic); response.work_id = `dbw_${"9".repeat(32)}`; validateAcknowledgementResponse(response, contract, { work: { work_id: trace.work_id }, acknowledgement: fixtures.get(trace.acknowledgement) }); }, "identity_conflict"],
  ["acknowledgement premature static terminal response", () => { const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").dynamic); response.work_id = claimedWorkFixture.publication_work[0].work_id; validateAcknowledgementResponse(response, contract, { work: claimedWorkFixture.publication_work[0], acknowledgement: fixtures.get("publication-acknowledgement-static-pending.json") }); }, "stage_conflict"],
  ["acknowledgement inappropriate dynamic nonterminal response", () => { const trace = fixtures.get("publication-dynamic-trace.json"); const response = structuredClone(fixtures.get("publication-acknowledgement-responses.json").synchronized); response.work_id = trace.work_id; response.correlation_id = fixtures.get(trace.acknowledgement).correlation_id; validateAcknowledgementResponse(response, contract, { work: { work_id: trace.work_id }, acknowledgement: fixtures.get(trace.acknowledgement) }); }, "stage_conflict"],
  ["existing topic rounded fractional token", () => validateResolveRecord(resolveWithExistingTopicToken("9007199254740992.5"), contract), "validation_failed"],
  ["existing topic exceeds signed 64-bit range", () => validateResolveRecord(resolveWithExistingTopicToken("9223372036854775808"), contract), "validation_failed"],
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
const cssCalcUrl = import.meta.resolve("@csstools/css-calc");
const cssTreeUrl = import.meta.resolve("css-tree");
const jsdomUrl = import.meta.resolve("jsdom");
async function loadValidatorMutation(label, search, replacement) {
  assert.equal(validatorSource.split(search).length, 2, `${label} mutation target must occur exactly once`);
  const source = validatorSource
    .replace('from "@csstools/css-calc";', `from "${cssCalcUrl}";`)
    .replace('from "css-tree";', `from "${cssTreeUrl}";`)
    .replace('from "jsdom";', `from "${jsdomUrl}";`)
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
  { received_at: "2026-09-27T18:31:00Z", claimed_at: claimedWorkFixture.claimed_at },
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
}), "premature-static-terminal regression must detect removal of the response terminal binding");

const activeText = [
  JSON.stringify(contract),
  JSON.stringify(operator),
  await readFile(path.join(root, "README.md"), "utf8"),
  await readFile(path.join(root, "MIGRATION.md"), "utf8"),
  ...positiveNames.map((name) => JSON.stringify(fixtures.get(name))),
].join("\n");
assert.doesNotMatch(activeText, /fullInteractive/);
assert.doesNotMatch(activeText, /Repeal OBBBA Forum|obbba-/i);

console.log(`Conformance validated ${positiveNames.length} positive fixtures, ${negativeNames.length} exact-error negative fixtures, ${mutationCases.length} mutation classes, and 3 targeted source-reversion probes for ${contract.version}.`);
