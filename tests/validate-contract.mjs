import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ProtocolError,
  canonicalize,
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
const load = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
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
const claimedWorkFixture = fixtures.get("publication-work-claim.json");
const renewalContext = {
  work: claimedWorkFixture.publication_work[0],
  state: "leased",
  claimed_at: claimedWorkFixture.claimed_at,
  request_received_at: "2026-09-27T18:34:00Z",
  current_total_lease_seconds: 300,
};
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
  "publication-work-claim.json": (value) => validateClaimResponse(value, contract),
  "publication-work-restore.json": (value) => validateClaimResponse(value, contract),
  "publication-work-withdrawal.json": (value) => validateClaimResponse(value, contract),
  "publication-lease-renewal.json": (value) => validateRenewal(value, contract, renewalContext),
  "publication-acknowledgement-create.json": (value) => validateAcknowledgement(value, contract),
  "publication-acknowledgement-static-pending.json": (value) => {
    validateAcknowledgement(value, contract);
    validateAcknowledgementIdentity(fixtures.get("publication-work-claim.json").publication_work[0], value);
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
    validateStageTransition(synchronized, deployed, responses.synchronized);
    validateStageTransition(deployed, verified, responses.deployed);
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
  "acknowledgement-revision-mismatch.json": (value) => validateAcknowledgementIdentity(value.work, { ...value.acknowledgement, stage: "synchronized" }),
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
  ["resolve complete envelope ceiling", () => { const value = structuredClone(baseComplete); value.source_authors = Array.from({ length: contract.resolve.field_rules.source_authors_maximum_items }, (_, index) => ({ source_author_id: `author-${index}-${"i".repeat(230)}`, source_author_name: `Author ${index} ${"n".repeat(180)}`, source_author_url: `https://example.com/${index}/${"u".repeat(1990)}` })); value.content_html = `<p>${"x".repeat(20000)}</p>`; value.source_content_bytes = Buffer.byteLength(value.content_html); value.source_content_sha256 = createHash("sha256").update(value.content_html).digest("hex"); validateResolveRecord(value, contract); }, "validation_failed"],
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
  ["valid-shaped wrong lease token", () => { const work = fixtures.get("publication-work-claim.json").publication_work[0]; const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.lease_token = "d".repeat(64); validateAcknowledgement(ack, contract); validateAcknowledgementIdentity(work, ack); }, "reconciliation_required"],
  ["valid-shaped wrong stage token", () => { const work = fixtures.get("publication-work-claim.json").publication_work[0]; const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.stage_token = "d".repeat(64); validateAcknowledgement(ack, contract); validateAcknowledgementIdentity(work, ack); }, "stage_conflict"],
  ["wrong acknowledgement resource", () => { const work = fixtures.get("publication-work-claim.json").publication_work[0]; const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.resource_id = "b4965d46-e657-4af4-af47-6439e544eeb8"; validateAcknowledgementIdentity(work, ack); }, "identity_conflict"],
  ["wrong acknowledgement destination policy", () => { const work = fixtures.get("publication-work-claim.json").publication_work[0]; const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.destination_policy_id = "destination:other:1"; validateAcknowledgementIdentity(work, ack); }, "identity_conflict"],
  ["wrong acknowledgement action", () => { const work = fixtures.get("publication-work-claim.json").publication_work[0]; const ack = structuredClone(fixtures.get("publication-acknowledgement-static-pending.json")); ack.action = "publish"; validateAcknowledgementIdentity(work, ack); }, "identity_conflict"],
  ["unissued next stage token", () => { const previous = fixtures.get("publication-acknowledgement-static-pending.json"); const next = structuredClone(fixtures.get("publication-acknowledgement-static-deployed.json")); next.stage_token = "a".repeat(64); validateStageTransition(previous, next, fixtures.get("publication-acknowledgement-responses.json").synchronized); }, "stage_conflict"],
  ["terminal dynamic acknowledgement advancement", () => validateStageTransition(fixtures.get("publication-acknowledgement-create.json"), fixtures.get("publication-acknowledgement-static-deployed.json"), { ...fixtures.get("publication-acknowledgement-responses.json").dynamic, terminal: false, next_stage_token: "3".repeat(64) }), "stage_conflict"],
  ["stage transition changed synchronized time", () => { const next = structuredClone(fixtures.get("publication-acknowledgement-static-deployed.json")); next.synchronized_at = "2026-09-27T18:31:01Z"; validateStageTransition(fixtures.get("publication-acknowledgement-static-pending.json"), next, fixtures.get("publication-acknowledgement-responses.json").synchronized); }, "identity_conflict"],
  ["same revision reused at higher sequence", () => { const stored = { source_revision: "revision:1", source_revision_sequence: 1, source_content_sha256: "a".repeat(64) }; const incoming = { source_revision: "revision:1", source_revision_sequence: 2, source_content_sha256: "b".repeat(64) }; validateRevisionTransition(stored, incoming); }, "reconciliation_required"],
  ["cursor connection mismatch", () => validateCursorSnapshot({ snapshot: "snap:1", connection_id: "dbc_222222222222222222222222", policy_revision: "policy:1" }, { snapshot: "snap:1", connection_id: "dbc_111111111111111111111111", policy_revision: "policy:1" }), "cursor_snapshot_mismatch"],
  ["cursor policy mismatch", () => validateCursorSnapshot({ snapshot: "snap:1", connection_id: "dbc_111111111111111111111111", policy_revision: "policy:2" }, { snapshot: "snap:1", connection_id: "dbc_111111111111111111111111", policy_revision: "policy:1" }), "cursor_snapshot_mismatch"],
  ["removed direct author mapping", () => validateResolvedPolicy({ container_mapping: {}, taxonomy_mapping: { items: [] }, author_mapping: { destination_id: "author:removed", items: [] } }, [{ id: "author:removed", available: false }]), "policy_denied"],
  ["same forum clone after claimed rotation", () => validateForumClone("dbf_11111111111111111111111111111111", "dbf_11111111111111111111111111111111", true), "identity_conflict"],
  ["claim expired before issuance", () => { const value = structuredClone(fixtures.get("publication-work-claim.json")); value.publication_work[0].lease_expires_at = "2026-09-27T18:29:59Z"; validateClaimResponse(value, contract); }, "work_expired"],
  ["renewal valid-shaped foreign lease", () => { const value = structuredClone(fixtures.get("publication-lease-renewal.json")); value.request.lease_token = "d".repeat(64); validateRenewal(value, contract, renewalContext); }, "lease_conflict"],
  ["renewal inactive work", () => validateRenewal(fixtures.get("publication-lease-renewal.json"), contract, { ...renewalContext, state: "retry_wait" }), "lease_conflict"],
  ["renewal inconsistent total", () => { const value = structuredClone(fixtures.get("publication-lease-renewal.json")); value.response.total_lease_seconds = 1; validateRenewal(value, contract, renewalContext); }, "validation_failed"],
  ["fractional lease expiry", () => validateLeaseTime("2026-09-27T18:30:00.0000Z", "2026-09-27T18:30:00.0001Z"), "work_expired"],
  ["invalid manual retry transition", () => { const value = structuredClone(fixtures.get("publication-retry-trace.json")); value.manual_retry.next_attempt_count = 999; value.manual_retry.reentry_state = "acknowledged"; validateRetryTrace(value, contract); }, "validation_failed"],
  ["invalid successful retry attempt", () => { const value = structuredClone(fixtures.get("publication-retry-trace.json")); value.successful_retry.attempt_count = 999; validateRetryTrace(value, contract); }, "validation_failed"],
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
  ["failure leaks lease token", () => { const value = structuredClone(fixtures.get("publication-failure.json")); value.error_detail = `failure ${value.lease_token}`; validateFailure(value, contract); }, "secret_exposure"],
  ["excerpt plain text read more", () => { const value = structuredClone(baseExcerpt); value.content_html = `Excerpt Read More ${value.canonical_url}`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt comment-only anchor", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><!-- <a href="${value.canonical_url}">Read More</a> -->`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt data-href only", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><p><a data-href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["excerpt wrong href with canonical data-href", () => { const value = structuredClone(baseExcerpt); value.content_html = `<p>Excerpt only.</p><p><a href="https://wrong.example/" data-href="${value.canonical_url}">Read More</a></p>`; validateResolveRecord(value, contract); }, "validation_failed"],
  ["chunk set invalid UTF-8", () => { const content = Buffer.from([0xff]); const digest = createHash("sha256").update(content).digest("hex"); const descriptor = { source_revision: "revision:invalid-utf8", byte_length: 1, sha256: digest, chunk_count: 1 }; const chunks = [{ source_revision: descriptor.source_revision, chunk: 1, chunk_count: 1, decoded_bytes: 1, chunk_sha256: digest, content_base64: content.toString("base64"), correlation_id: "invalid-utf8-01" }]; validateChunkSet(descriptor, chunks, contract); }, "integrity_failed"],
  ["package version mismatch", () => validateRepositoryIdentity({ ...packageMetadata, version: "0.2.0-alpha.20" }, contract, operator), "contract_version_mismatch"],
  ["operator contract version mismatch", () => validateRepositoryIdentity(packageMetadata, contract, { ...operator, version: "0.2.0-alpha.20" }), "contract_version_mismatch"],
  ["authentication header version mismatch", () => { const value = structuredClone(contract); value.authentication.contract_header_value = "0.2.0-alpha.20"; validateRepositoryIdentity(packageMetadata, value, operator); }, "contract_version_mismatch"],
];
for (const [name, operation, code] of mutationCases) {
  assert.throws(operation, (error) => error instanceof ProtocolError && error.code === code, `mutation ${name} must fail with ${code}`);
}

const activeText = [
  JSON.stringify(contract),
  JSON.stringify(operator),
  await readFile(path.join(root, "README.md"), "utf8"),
  await readFile(path.join(root, "MIGRATION.md"), "utf8"),
  ...positiveNames.map((name) => JSON.stringify(fixtures.get(name))),
].join("\n");
assert.doesNotMatch(activeText, /fullInteractive/);
assert.doesNotMatch(activeText, /Repeal OBBBA Forum|obbba-/i);

console.log(`Conformance validated ${positiveNames.length} positive fixtures, ${negativeNames.length} exact-error negative fixtures, and ${mutationCases.length} mutation classes for ${contract.version}.`);
