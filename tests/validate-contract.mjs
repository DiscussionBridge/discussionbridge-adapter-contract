import assert from "node:assert/strict";
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
  validateResolvedPolicy,
  validateResolveRecord,
  validateResolveResponse,
  validateRetiredUrl,
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
const positiveDirectory = path.join(root, "fixtures");
const negativeDirectory = path.join(positiveDirectory, "invalid");
const positiveNames = (await readdir(positiveDirectory)).filter((name) => name.endsWith(".json")).sort();
const negativeNames = (await readdir(negativeDirectory)).filter((name) => name.endsWith(".json")).sort();
const fixtures = new Map();
for (const name of positiveNames) fixtures.set(name, await load(`fixtures/${name}`));
const invalid = new Map();
for (const name of negativeNames) invalid.set(name, await load(`fixtures/invalid/${name}`));

assert.equal(contract.contract, "discussionbridge-adapter");
assert.equal(contract.version, "0.2.0-alpha.21");
assert.deepEqual(contract.configuration.presentation_modes, ["simple", "full", "interactive"]);
assert.equal(contract.publication_work.initial_attempts + contract.publication_work.maximum_automatic_retries, contract.publication_work.maximum_total_attempts);
assert.equal(contract.publication_work.retry_backoff_seconds.length, contract.publication_work.maximum_automatic_retries);
assert.equal(operator.entitlement.canonicalization, "RFC 8785 JCS");

const trustVector = fixtures.get("operator-entitlement-test-vector.json");
const trust = { [`${trustVector.issuer_id}:${trustVector.key_id}`]: trustVector.public_key_base64url };

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
  "publication-lease-renewal.json": (value) => validateRenewal(value, contract),
  "publication-acknowledgement-create.json": (value) => validateAcknowledgement(value, contract),
  "publication-acknowledgement-static-pending.json": (value) => validateAcknowledgement(value, contract),
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
    validateStageTransition(synchronized, deployed);
    validateStageTransition(deployed, verified);
    assert.deepEqual(value.interruption_recovery_states, ["awaiting_deployment", "awaiting_verification"]);
    assert.equal(value.terminal_state, "acknowledged");
  },
  "publication-retry-trace.json": (value) => {
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
    assert.equal(value.preflight, "passed");
    assert.equal(value.mismatch_rejected_before_mutation, true);
    assert.equal(value.one_item_canary, "passed");
    assert.equal(value.ten_item_canary, "passed");
  },
};

for (const name of positiveNames) {
  assert.ok(positiveHandlers[name], `positive fixture has no validator: ${name}`);
  positiveHandlers[name](fixtures.get(name));
}

const baseComplete = fixtures.get("to-discourse-request.json").bridge_record;
const baseExcerpt = fixtures.get("to-discourse-excerpt-request.json").bridge_record;
const baseAck = fixtures.get("publication-acknowledgement.json");
const baseNetwork = fixtures.get("network-source-detail.json").network_provenance;
const validEntitlement = fixtures.get("operator-entitlement.json");

const negativeHandlers = {
  "acknowledgement-deployed-terminal.json": (value) => validateAcknowledgementResponse({ ...structuredClone(fixtures.get("publication-acknowledgement-responses.json").verified), accepted_stage: value.accepted_stage, terminal: value.terminal }, contract),
  "acknowledgement-revision-mismatch.json": (value) => validateAcknowledgementIdentity(value.work, value.acknowledgement),
  "acknowledgement-stage-skipped.json": () => validateStageTransition(fixtures.get("publication-acknowledgement-static-pending.json"), fixtures.get("publication-acknowledgement.json")),
  "acknowledgement-stale-stage-token.json": () => { const next = structuredClone(fixtures.get("publication-acknowledgement-static-deployed.json")); next.stage_token = fixtures.get("publication-acknowledgement-static-pending.json").stage_token; validateStageTransition(fixtures.get("publication-acknowledgement-static-pending.json"), next); },
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
  "operator-entitlement-grace-mutation.json": (value) => validateOperatorEntitlement(validEntitlement, operator, trust, { at: value.request_at, mutation: value.mutation }),
  "operator-entitlement-invalid-signature.json": (value) => validateOperatorEntitlement({ ...structuredClone(validEntitlement), ...value.entitlement }, operator, trust),
  "operator-entitlement-not-yet-valid.json": (value) => validateOperatorEntitlement(validEntitlement, operator, trust, { at: value.request_at }),
  "operator-entitlement-noncanonical-signature.json": (value) => validateOperatorEntitlement({ ...structuredClone(validEntitlement), signature: value.signature }, operator, trust),
  "operator-entitlement-replaced.json": (value) => validateOperatorEntitlement(validEntitlement, operator, trust, { state: value.state }),
  "operator-entitlement-revoked.json": (value) => validateOperatorEntitlement(validEntitlement, operator, trust, { state: value.state }),
  "operator-entitlement-wrong-forum.json": (value) => validateOperatorEntitlement(validEntitlement, operator, trust, { forumId: value.local_forum_id }),
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
  ["renewal unknown field", () => { const value = structuredClone(fixtures.get("publication-lease-renewal.json")); value.request.unexpected = true; validateRenewal(value, contract); }, "unknown_field"],
  ["acknowledgement unknown field", () => validateAcknowledgement({ ...structuredClone(baseAck), unexpected: true }, contract), "unknown_field"],
  ["acknowledgement response unknown field", () => validateAcknowledgementResponse({ ...structuredClone(fixtures.get("publication-acknowledgement-responses.json").verified), unexpected: true }, contract), "unknown_field"],
  ["failure unknown field", () => validateFailure({ ...structuredClone(fixtures.get("publication-failure.json")), unexpected: true }, contract), "unknown_field"],
  ["catalog unknown field", () => validateCatalogSegment({ ...structuredClone(fixtures.get("platform-catalog-authors.json")), unexpected: true }, contract), "unknown_field"],
  ["error unknown field", () => validateErrorResponse({ ...structuredClone(fixtures.get("rejected-response.json")), unexpected: true }, contract), "unknown_field"],
  ["operator entitlement unknown field", () => validateOperatorEntitlement({ ...structuredClone(validEntitlement), unexpected: true }, operator, trust), "unknown_field"],
  ["operator audit unknown field", () => validateOperatorAudit({ ...structuredClone(fixtures.get("operator-enrollment-audit.json")), unexpected: true }, operator), "unknown_field"],
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
