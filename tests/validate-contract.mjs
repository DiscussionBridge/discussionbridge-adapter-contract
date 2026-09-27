import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDirectory = path.join(root, "fixtures");
const invalidFixtureDirectory = path.join(fixtureDirectory, "invalid");

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
const bytes = (value) => Buffer.byteLength(value, "utf8");
const rfc3339Utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const assertTimestamp = (value, label) => {
  assert.match(value, rfc3339Utc, `${label} is not RFC 3339 UTC`);
  assert.ok(Number.isFinite(Date.parse(value)), `${label} is not a real timestamp`);
};

const contract = await readJson("contract.json");
const operator = await readJson("operator-service-contract.json");
const packageJson = await readJson("package.json");
const readme = await readFile(path.join(root, "README.md"), "utf8");
const migration = await readFile(path.join(root, "MIGRATION.md"), "utf8");
const coverage = await readFile(path.join(root, "COVERAGE.md"), "utf8");

assert.equal(contract.contract, "discussionbridge-adapter");
assert.equal(contract.version, "0.2.0-alpha.21");
assert.equal(operator.version, contract.version);
assert.equal(packageJson.version, contract.version);

assert.deepEqual(contract.configuration.presentation_modes, [
  "simple",
  "full",
  "interactive",
]);
assert.equal(contract.configuration.forum_name.fallback, null);
assert.equal(
  contract.configuration.forum_name.environment_variable,
  "DISCUSSIONBRIDGE_FORUM_NAME",
);

assert.equal(
  contract.authentication.connection_header,
  "X-DiscussionBridge-Connection",
);
assert.equal(
  contract.authentication.secret_header,
  "X-DiscussionBridge-Secret",
);
assert.equal(
  contract.authentication.contract_header,
  "X-DiscussionBridge-Contract",
);
assert.equal(contract.authentication.contract_header_value, contract.version);
assert.equal(
  contract.resolve.path,
  "/discussion-bridge/v1/bridge-records/resolve.json",
);
assert.equal(contract.resolve.maximum_json_bytes, 65536);
assert.equal(contract.resolve.field_rules.content_html_maximum_bytes, 49152);
assert.equal(contract.records.records_per_page, 100);
assert.equal(contract.records.maximum_page, 10000);
assert.deepEqual(contract.records.binding_roles, ["source", "presentation"]);
for (const state of contract.records.binding_states) {
  assert.ok(
    Object.hasOwn(contract.records.binding_transitions, state),
    `binding transitions miss ${state}`,
  );
}
for (const state of contract.records.deployment_states) {
  assert.ok(
    Object.hasOwn(contract.records.deployment_transitions, state),
    `deployment transitions miss ${state}`,
  );
}

assert.equal(contract.source_publication.inventory.maximum_limit, 100);
assert.equal(contract.source_publication.revocations.maximum_limit, 100);
assert.equal(
  contract.source_publication.content_transport.chunked.decoded_chunk_maximum_bytes,
  32768,
);
assert.match(
  contract.source_publication.content_transport.chunked.total_size_rule,
  /no universal destination-content ceiling/i,
);

assert.equal(contract.publication_work.claim.maximum_items, 32);
assert.ok(
  contract.publication_work.claim.maximum_total_lease_seconds >=
    contract.publication_work.claim.maximum_requested_lease_seconds,
);
assert.equal(contract.publication_work.maximum_automatic_attempts, 3);
assert.deepEqual(contract.publication_work.retry_backoff_seconds, [60, 300, 900]);
for (const state of contract.publication_work.lifecycle_states) {
  assert.ok(
    Object.hasOwn(contract.publication_work.lifecycle_transitions, state),
    `work transitions miss ${state}`,
  );
}

const responseErrorCodes = new Set(
  Object.values(contract.error_responses.statuses).flat(),
);
for (const errorCode of [
  "unknown_field",
  "direction_denied",
  "scope_denied",
  "revision_conflict",
  "cursor_snapshot_mismatch",
  "integrity_failed",
  "lease_limit_exceeded",
  "work_expired",
]) {
  assert.ok(responseErrorCodes.has(errorCode), `error registry misses ${errorCode}`);
}

assert.match(contract.platform_catalog.authority_rule, /cannot authorize/i);
assert.equal(operator.relationship.maximum_active_providers_per_forum, 1);
assert.match(
  operator.relationship.content_connection_separation,
  /never grants, replaces, reveals, or expands/i,
);
assert.deepEqual(contract.discourse_network.managed_scopes, ["first_post"]);

const fixtureNames = (await readdir(fixtureDirectory))
  .filter((name) => name.endsWith(".json"))
  .sort();
assert.ok(fixtureNames.length >= 15);

const fixtures = new Map();
for (const name of fixtureNames) {
  fixtures.set(name, await readJson(path.join("fixtures", name)));
}

const connectionCapability = fixtures.get("connection-capability.json");
for (const field of contract.connection_capability.required_fields) {
  assert.ok(Object.hasOwn(connectionCapability, field), `connection capability misses ${field}`);
}
assert.equal(connectionCapability.contract_version, contract.version);
assert.deepEqual(
  connectionCapability.allowed_presentation_modes,
  contract.configuration.presentation_modes,
);

const invalidFixtureNames = (await readdir(invalidFixtureDirectory))
  .filter((name) => name.endsWith(".json"))
  .sort();
const invalidFixtures = new Map();
for (const name of invalidFixtureNames) {
  const value = JSON.parse(
    await readFile(path.join(invalidFixtureDirectory, name), "utf8"),
  );
  assert.ok(value.expected_error, `${name} misses expected_error`);
  invalidFixtures.set(name, value);
}

for (const name of ["created-response.json", "resolved-response.json"]) {
  const response = fixtures.get(name);
  for (const field of contract.resolve.success_response_required_fields) {
    assert.ok(Object.hasOwn(response, field), `${name} misses ${field}`);
  }
  assert.ok(response.accepted_source_revision_sequence > 0);
  assert.equal(response.core_fallback, false);
}

const reconciliation = fixtures.get("reconciliation-required-response.json");
for (const field of contract.resolve.reconciliation_response_required_fields) {
  assert.ok(Object.hasOwn(reconciliation, field), `reconciliation response misses ${field}`);
}
assert.equal(reconciliation.outcome, "reconciliation_required");

for (const name of ["to-discourse-request.json", "to-discourse-excerpt-request.json"]) {
  const filePath = path.join(fixtureDirectory, name);
  const raw = await readFile(filePath);
  assert.ok(raw.length <= contract.resolve.maximum_json_bytes, `${name} exceeds JSON bound`);
  const record = fixtures.get(name).bridge_record;
  for (const field of contract.resolve.required_fields) {
    assert.ok(Object.hasOwn(record, field), `${name} misses ${field}`);
  }
  assert.ok(contract.configuration.presentation_modes.includes(record.presentation_mode));
  assert.ok(Number.isSafeInteger(record.source_revision_sequence));
  assert.ok(record.source_revision_sequence > 0);
  assert.ok(bytes(record.content_html) <= contract.resolve.field_rules.content_html_maximum_bytes);
  assert.match(record.source_content_sha256, /^[a-f0-9]{64}$/);
  if (record.content_disposition === "complete") {
    assert.equal(bytes(record.content_html), record.source_content_bytes);
    assert.equal(sha256(record.content_html), record.source_content_sha256);
    assert.equal(Object.hasOwn(record, "read_more_url"), false);
  } else {
    assert.equal(record.content_disposition, "excerpt");
    assert.equal(record.read_more_url, record.canonical_url);
    assert.match(record.content_html, /Read More/);
    assert.match(record.content_html, new RegExp(record.canonical_url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(record.source_content_bytes > bytes(record.content_html));
  }
  assert.ok(!raw.includes(Buffer.from("fullInteractive")));
}

const wikiUpdate = fixtures.get("to-discourse-wiki-update-request.json");
assert.equal(wikiUpdate.bridge_record.external_id, wikiUpdate.stored.external_id);
assert.equal(wikiUpdate.bridge_record.canonical_url, wikiUpdate.stored.canonical_url);
assert.ok(
  wikiUpdate.bridge_record.source_revision_sequence >
    wikiUpdate.stored.source_revision_sequence,
);
assert.notEqual(
  wikiUpdate.bridge_record.source_revision,
  wikiUpdate.stored.source_revision,
);
assert.equal(
  sha256(wikiUpdate.bridge_record.content_html),
  wikiUpdate.bridge_record.source_content_sha256,
);
assert.equal(wikiUpdate.expected_outcome, "resolved");

for (const name of [
  "from-discourse-record.json",
  "source-detail-inline.json",
  "network-source-detail.json",
  "network-spoke-source-detail.json",
]) {
  const value = fixtures.get(name);
  const transport = value.content_transport ?? value.bridge_record.content_transport;
  assert.equal(transport.mode, "inline");
  assert.equal(bytes(transport.content_html), transport.byte_length);
  assert.equal(sha256(transport.content_html), transport.sha256);
}

for (const name of ["source-detail-inline.json", "source-detail-chunked.json"]) {
  const value = fixtures.get(name);
  assertTimestamp(value.source_created_at, `${name}.source_created_at`);
  assertTimestamp(value.source_updated_at, `${name}.source_updated_at`);
  assert.ok(value.source_revision_sequence > 0);
}

const chunk = fixtures.get("source-content-chunk.json");
const decoded = Buffer.from(chunk.content_base64, "base64");
assert.equal(decoded.length, chunk.decoded_bytes);
assert.equal(sha256(decoded), chunk.chunk_sha256);
assert.ok(
  decoded.length <=
    contract.source_publication.content_transport.chunked.decoded_chunk_maximum_bytes,
);

const resumedInventory = fixtures.get("source-inventory-resume-page.json");
assert.equal(
  resumedInventory.request.snapshot,
  resumedInventory.response.snapshot,
);
for (const field of contract.source_publication.inventory.required_response_fields) {
  assert.ok(
    Object.hasOwn(resumedInventory.response, field),
    `resumed inventory misses ${field}`,
  );
}
assert.equal(resumedInventory.response.complete, true);
assert.equal(resumedInventory.response.next_cursor, null);

const work = fixtures.get("publication-work-claim.json").publication_work[0];
for (const field of contract.publication_work.work_required_fields) {
  assert.ok(Object.hasOwn(work, field), `publication work misses ${field}`);
}
assert.ok(contract.publication_work.actions.includes(work.action));
assert.ok(Number.isSafeInteger(work.source_revision_sequence));
assert.ok(work.source_revision_sequence > 0);
assert.match(work.work_id, new RegExp(contract.publication_work.work_id_pattern));
assert.match(work.lease_token, new RegExp(contract.publication_work.lease_token_pattern));
for (const field of contract.publication_work.claim.response_required_fields) {
  assert.ok(
    Object.hasOwn(fixtures.get("publication-work-claim.json"), field),
    `publication claim response misses ${field}`,
  );
}

const restoreWork = fixtures.get("publication-work-restore.json").publication_work[0];
assert.equal(restoreWork.action, "restore");
assert.ok(contract.publication_work.actions.includes(restoreWork.action));
for (const field of contract.publication_work.work_required_fields) {
  assert.ok(Object.hasOwn(restoreWork, field), `restore work misses ${field}`);
}

const withdrawalWork = fixtures.get("publication-work-withdrawal.json").publication_work;
assert.deepEqual(
  withdrawalWork.map((item) => item.action),
  ["hold", "unpublish"],
);
for (const item of withdrawalWork) {
  for (const field of contract.publication_work.work_required_fields) {
    assert.ok(Object.hasOwn(item, field), `withdrawal work misses ${field}`);
  }
}

const renewal = fixtures.get("publication-lease-renewal.json");
for (const field of contract.publication_work.renew.required_fields) {
  assert.ok(Object.hasOwn(renewal.request, field), `renewal request misses ${field}`);
}
for (const field of contract.publication_work.renew.response_required_fields) {
  assert.ok(Object.hasOwn(renewal.response, field), `renewal response misses ${field}`);
}
assert.ok(
  renewal.response.total_lease_seconds <=
    contract.publication_work.claim.maximum_total_lease_seconds,
);

const exhaustedWork = fixtures.get("publication-work-exhausted.json");
assert.equal(
  exhaustedWork.attempt_count,
  contract.publication_work.maximum_automatic_attempts,
);
assert.equal(exhaustedWork.resulting_state, "operator_attention");
assert.equal(exhaustedWork.next_retry_at, null);

const retryWait = fixtures.get("publication-work-retry-wait.json");
assert.equal(retryWait.resulting_state, "retry_wait");
assert.equal(
  retryWait.backoff_seconds,
  contract.publication_work.retry_backoff_seconds[retryWait.attempt_count - 1],
);
assert.equal(
  Date.parse(retryWait.next_retry_at) - Date.parse(retryWait.failed_at),
  retryWait.backoff_seconds * 1000,
);

const acknowledgement = fixtures.get("publication-acknowledgement.json");
for (const name of [
  "publication-acknowledgement-create.json",
  "publication-acknowledgement.json",
  "publication-acknowledgement-static-pending.json",
]) {
  const value = fixtures.get(name);
  for (const field of contract.publication_work.acknowledgement.required_fields) {
    assert.ok(Object.hasOwn(value, field), `${name} misses ${field}`);
  }
}
if (acknowledgement.verification_state === "verified") {
  assert.ok(acknowledgement.publicly_verified_at);
}
assert.equal(acknowledgement.deployment_state, "deployed");
assert.ok(acknowledgement.deployed_at);

const createAcknowledgement = fixtures.get("publication-acknowledgement-create.json");
assert.equal(createAcknowledgement.action, "publish");
assert.equal(createAcknowledgement.deployment_state, "not_required");
assert.equal(createAcknowledgement.verification_state, "not_required");
assert.equal(Object.hasOwn(createAcknowledgement, "deployed_at"), false);
assert.equal(Object.hasOwn(createAcknowledgement, "publicly_verified_at"), false);

const pendingAcknowledgement = fixtures.get(
  "publication-acknowledgement-static-pending.json",
);
assert.equal(pendingAcknowledgement.verification_state, "pending");
assert.equal(pendingAcknowledgement.deployment_state, "pending");
assert.equal(Object.hasOwn(pendingAcknowledgement, "deployed_at"), false);
assert.equal(Object.hasOwn(pendingAcknowledgement, "publicly_verified_at"), false);

const failure = fixtures.get("publication-failure.json");
const registeredFailureCodes = new Set([
  ...contract.failure_registry.retryable,
  ...contract.failure_registry.terminal,
]);
assert.ok(registeredFailureCodes.has(failure.error_code));
assert.ok(bytes(failure.error_detail) <= contract.common.error_detail_maximum_bytes);

const catalog = fixtures.get("platform-catalog-segment.json");
assert.ok(contract.platform_catalog.segment_types.includes(catalog.segment_type));
assert.ok(catalog.items.length <= contract.platform_catalog.maximum_items_per_segment);
assert.deepEqual(
  catalog.items.map((item) => item.id),
  contract.configuration.presentation_modes,
);

for (const name of ["network-source-detail.json", "network-spoke-source-detail.json"]) {
  const network = fixtures.get(name).network_provenance;
  for (const field of contract.discourse_network.required_provenance_fields) {
    assert.ok(Object.hasOwn(network, field), `${name} provenance misses ${field}`);
  }
  assert.ok(contract.discourse_network.relationships.includes(network.relationship));
  assert.ok(contract.discourse_network.managed_scopes.includes(network.managed_scope));
  assert.equal(new Set(network.route_forum_ids).size, network.route_forum_ids.length);
  assert.ok(network.route_forum_ids.length <= contract.discourse_network.route_maximum_forums);
}

const entitlement = fixtures.get("operator-entitlement.json");
for (const field of operator.entitlement.required_fields) {
  assert.ok(Object.hasOwn(entitlement, field), `operator entitlement misses ${field}`);
}
assert.match(entitlement.issuer_id, new RegExp(operator.entitlement.issuer_id_pattern));
assert.match(entitlement.signature, /^[A-Za-z0-9_-]+$/);
for (const field of ["issued_at", "not_before", "expires_at", "grace_until"]) {
  assertTimestamp(entitlement[field], `operator entitlement ${field}`);
}
assert.ok(Date.parse(entitlement.not_before) >= Date.parse(entitlement.issued_at));
assert.ok(Date.parse(entitlement.expires_at) > Date.parse(entitlement.not_before));
assert.ok(Date.parse(entitlement.grace_until) >= Date.parse(entitlement.expires_at));

const revocationAudit = fixtures.get("operator-revocation-audit.json");
for (const name of ["operator-enrollment-audit.json", "operator-revocation-audit.json"]) {
  const audit = fixtures.get(name);
  for (const field of operator.audit.required_fields) {
    assert.ok(Object.hasOwn(audit, field), `${name} misses ${field}`);
  }
  assert.ok(operator.audit.outcomes.includes(audit.outcome));
  assert.match(audit.event_id, new RegExp(operator.audit.event_id_pattern));
}
assert.equal(revocationAudit.outcome, "revoked");

assert.ok(
  !contract.configuration.presentation_modes.includes(
    invalidFixtures.get("full-interactive-request.json").bridge_record.presentation_mode,
  ),
);

const invalidExcerpt = invalidFixtures.get("excerpt-read-more-mismatch.json").bridge_record;
assert.notEqual(invalidExcerpt.read_more_url, invalidExcerpt.canonical_url);
assert.doesNotMatch(invalidExcerpt.content_html, /Read More<\/a>/);

const networkLoop = invalidFixtures.get("network-loop.json");
assert.ok(
  networkLoop.network_provenance.route_forum_ids.includes(networkLoop.local_forum_id),
);

const invalidEntitlement = invalidFixtures.get(
  "operator-entitlement-wrong-scope.json",
).entitlement;
assert.ok(
  invalidEntitlement.scopes.some(
    (scope) => !operator.entitlement.allowed_scopes.includes(scope),
  ),
);

const wrongLease = invalidFixtures.get("wrong-lease-token.json").acknowledgement;
assert.doesNotMatch(
  wrongLease.lease_token,
  new RegExp(contract.publication_work.lease_token_pattern),
);

const wrongContractVersion = invalidFixtures.get("wrong-contract-version.json").headers;
assert.notEqual(
  wrongContractVersion[contract.authentication.contract_header],
  contract.authentication.contract_header_value,
);

const revisionConflict = invalidFixtures.get("revision-sequence-conflict.json");
assert.equal(
  revisionConflict.stored.source_revision_sequence,
  revisionConflict.incoming.source_revision_sequence,
);
assert.notEqual(
  revisionConflict.stored.source_revision,
  revisionConflict.incoming.source_revision,
);
assert.notEqual(
  revisionConflict.stored.source_content_sha256,
  revisionConflict.incoming.source_content_sha256,
);

const staleRevision = invalidFixtures.get("stale-revision-request.json");
assert.ok(
  staleRevision.incoming.source_revision_sequence <
    staleRevision.stored.source_revision_sequence,
);

const identityConflict = invalidFixtures.get("identity-url-conflict.json");
assert.equal(identityConflict.incoming.canonical_url, identityConflict.stored.canonical_url);
assert.notEqual(identityConflict.incoming.external_id, identityConflict.stored.external_id);

const cursorMismatch = invalidFixtures.get("snapshot-cursor-mismatch.json");
assert.notEqual(cursorMismatch.request.snapshot, cursorMismatch.cursor_binding.snapshot);

const integrityFailure = invalidFixtures.get("source-content-integrity.json");
const integrityBytes = Buffer.concat(
  integrityFailure.chunks.map((item) => Buffer.from(item.content_base64, "base64")),
);
assert.notEqual(sha256(integrityBytes), integrityFailure.descriptor.sha256);

const acknowledgementMismatch = invalidFixtures.get(
  "acknowledgement-revision-mismatch.json",
);
assert.notEqual(
  acknowledgementMismatch.acknowledgement.source_revision,
  acknowledgementMismatch.work.source_revision,
);

const missingVerificationTime = invalidFixtures.get(
  "acknowledgement-verified-time-missing.json",
).acknowledgement;
assert.equal(missingVerificationTime.verification_state, "verified");
assert.equal(Object.hasOwn(missingVerificationTime, "publicly_verified_at"), false);

const renewalOverLimit = invalidFixtures.get("lease-renewal-over-limit.json");
assert.ok(
  renewalOverLimit.current_total_lease_seconds +
    renewalOverLimit.requested_lease_seconds >
    renewalOverLimit.maximum_total_lease_seconds,
);

const expiredLease = invalidFixtures.get("lease-expired.json");
assert.ok(Date.parse(expiredLease.request_received_at) > Date.parse(expiredLease.lease_expires_at));

const supersededWork = invalidFixtures.get("work-superseded.json");
assert.notEqual(
  supersededWork.leased_work.source_revision,
  supersededWork.authoritative.source_revision,
);
assert.notEqual(
  supersededWork.leased_work.policy_revision,
  supersededWork.authoritative.policy_revision,
);

const brokenAncestry = invalidFixtures.get("source-url-broken-ancestry.json");
assert.notEqual(
  brokenAncestry.transitions.at(-1).new_url,
  brokenAncestry.to_url,
);

const destinationCollision = invalidFixtures.get(
  "source-url-destination-collision.json",
);
assert.equal(destinationCollision.to_url, destinationCollision.existing_binding.canonical_url);
assert.notEqual(
  destinationCollision.moving_resource_id,
  destinationCollision.existing_binding.resource_id,
);

const retiredConflict = invalidFixtures.get("source-url-retired-conflict.json");
assert.equal(retiredConflict.to_url, retiredConflict.retired_binding.canonical_url);
assert.equal(retiredConflict.retired_binding.state, "retired");

const catalogExpansion = invalidFixtures.get("catalog-authority-expansion.json");
assert.equal(
  catalogExpansion.connection.directions.includes(catalogExpansion.requested_direction),
  false,
);

const expiredEntitlement = invalidFixtures.get("operator-entitlement-expired.json");
assert.ok(
  Date.parse(expiredEntitlement.request_at) >
    Date.parse(expiredEntitlement.entitlement.grace_until),
);

const invalidSignature = invalidFixtures.get(
  "operator-entitlement-invalid-signature.json",
).entitlement;
assert.doesNotMatch(invalidSignature.signature, /^[A-Za-z0-9_-]+$/);

const selfOrigin = invalidFixtures.get("network-self-origin.json");
assert.equal(selfOrigin.local_forum_id, selfOrigin.network_provenance.origin_forum_id);

const repeatedRoute = invalidFixtures.get("network-repeated-route.json");
assert.notEqual(
  new Set(repeatedRoute.network_provenance.route_forum_ids).size,
  repeatedRoute.network_provenance.route_forum_ids.length,
);

const unsupportedScope = invalidFixtures.get("network-unsupported-scope.json");
assert.equal(
  contract.discourse_network.managed_scopes.includes(
    unsupportedScope.network_provenance.managed_scope,
  ),
  false,
);

const unknownField = invalidFixtures.get("unknown-field.json");
assert.ok(Object.hasOwn(unknownField.bridge_record, "unexpected_control"));

const overLimitTitle = invalidFixtures.get("over-limit-title.json");
assert.ok(overLimitTitle.title_byte_length > overLimitTitle.maximum_title_bytes);

const malformedTimestamp = invalidFixtures.get("malformed-timestamp.json");
assert.doesNotMatch(malformedTimestamp.source_updated_at, rfc3339Utc);

const wrongDirection = invalidFixtures.get("wrong-direction.json");
assert.equal(
  wrongDirection.connection.directions.includes(wrongDirection.request.direction),
  false,
);

const wrongScope = invalidFixtures.get("wrong-connection-scope.json");
assert.equal(wrongScope.connection.lanes.includes(wrongScope.request.lane), false);

const secretLeak = invalidFixtures.get("secret-leak-error.json");
assert.match(
  secretLeak.error_response.message,
  new RegExp(secretLeak.headers[contract.authentication.secret_header]),
);

const requiredNegativeErrors = new Set([
  "unknown_field",
  "malformed_value",
  "validation_failed",
  "integrity_failed",
  "revision_conflict",
  "identity_conflict",
  "destination_collision",
  "url_retired",
  "cursor_snapshot_mismatch",
  "lease_limit_exceeded",
  "work_expired",
  "work_superseded",
  "direction_denied",
  "scope_denied",
  "entitlement_expired",
  "entitlement_invalid_signature",
  "secret_exposure",
]);
for (const expectedError of requiredNegativeErrors) {
  assert.ok(
    [...invalidFixtures.values()].some((fixture) => fixture.expected_error === expectedError),
    `negative fixtures miss ${expectedError}`,
  );
}
for (const scope of entitlement.scopes) {
  assert.ok(operator.entitlement.allowed_scopes.includes(scope), `unknown operator scope ${scope}`);
}

const activeText = [
  JSON.stringify(contract),
  JSON.stringify(operator),
  readme,
  migration,
  coverage,
  ...fixtureNames.map((name) => JSON.stringify(fixtures.get(name))),
].join("\n");
assert.doesNotMatch(activeText, /fullInteractive/);
assert.doesNotMatch(activeText, /Repeal OBBBA Forum|obbba-/i);

console.log(
  `Validated ${fixtureNames.length} positive and ${invalidFixtureNames.length} negative fixtures for ${contract.version}.`,
);
