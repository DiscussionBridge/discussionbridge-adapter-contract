import { createHash, createPublicKey, verify } from "node:crypto";

export class ProtocolError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
  }
}

const bytes = (value) => Buffer.byteLength(value, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const base64urlPattern = /^[A-Za-z0-9_-]+$/;

function fail(code, message) {
  throw new ProtocolError(code, message);
}

function object(value, name = "value") {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("validation_failed", `${name} must be an object`);
}

function exactObject(value, required, optional = [], name = "value") {
  object(value, name);
  for (const field of required) if (!Object.hasOwn(value, field)) fail("validation_failed", `${name}.${field} is required`);
  const allowed = new Set([...required, ...optional]);
  for (const field of Object.keys(value)) if (!allowed.has(field)) fail("unknown_field", `${name}.${field} is unknown`);
}

function nonblank(value, maximum, name) {
  if (typeof value !== "string" || value.trim() === "" || bytes(value) > maximum) fail("validation_failed", `${name} is invalid`);
}

function timestamp(value, name) {
  if (typeof value !== "string") fail("validation_failed", `${name} is required`);
  if (!timestampPattern.test(value) || !Number.isFinite(Date.parse(value))) fail("malformed_value", `${name} is not RFC 3339 UTC`);
}

function pattern(value, source, code = "validation_failed", name = "value") {
  if (typeof value !== "string" || !(new RegExp(source)).test(value)) fail(code, `${name} has invalid format`);
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) fail("validation_failed", `${name} must be a positive integer`);
}

function correlation(value, contract) {
  nonblank(value, contract.common.correlation_id_maximum_bytes, "correlation_id");
}

export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

export function validatePresentationMode(mode, contract) {
  if (!contract.configuration.presentation_modes.includes(mode)) fail("validation_failed", "unsupported presentation mode");
}

export function validateConnectionCapability(value, contract) {
  exactObject(value, [...contract.connection_capability.required_fields, "correlation_id"], ["forum_name"], "connection capability");
  if (value.contract_version !== contract.version) fail("validation_failed", "wrong contract version");
  pattern(value.connection_id, contract.authentication.connection_id_pattern);
  if (typeof value.enabled !== "boolean" || !Array.isArray(value.directions) || !Array.isArray(value.lanes)) fail("validation_failed");
  if (value.directions.includes("from_discourse")) nonblank(value.forum_name, contract.configuration.forum_name.maximum_bytes, "forum_name");
  if (value.allowed_presentation_modes.join("|") !== contract.configuration.presentation_modes.join("|")) fail("validation_failed");
  if (value.supported_operations.some((item) => !contract.connection_capability.supported_operations.includes(item))) fail("validation_failed");
  exactObject(value.bounds, contract.connection_capability.bounds_required_fields, [], "bounds");
  const expectedBounds = {
    resolve_json_bytes: contract.resolve.maximum_json_bytes,
    source_content_bytes: contract.common.source_content_maximum_bytes,
    claim_maximum_items: contract.publication_work.claim.maximum_items,
    lease_maximum_seconds: contract.publication_work.claim.maximum_total_lease_seconds,
    catalog_segment_items: contract.platform_catalog.maximum_items_per_segment,
  };
  for (const [field, expected] of Object.entries(expectedBounds)) if (value.bounds[field] !== expected) fail("validation_failed");
  if (!Array.isArray(value.destination_policies) || value.destination_policies.length === 0) fail("validation_failed");
  for (const policy of value.destination_policies) {
    exactObject(policy, contract.connection_capability.destination_policy_required_fields, [], "destination policy");
    if (!contract.profiles.includes(policy.profile)) fail("validation_failed");
    validatePresentationMode(policy.presentation_mode, contract);
    const rules = contract.connection_capability.destination_policy_field_rules;
    exactObject(policy.container_mapping, rules.container_mapping_required_fields, [], "container mapping");
    exactObject(policy.taxonomy_mapping, rules.taxonomy_mapping_required_fields, rules.taxonomy_mapping_optional_fields, "taxonomy mapping");
    exactObject(policy.author_mapping, rules.author_mapping_required_fields, rules.author_mapping_optional_fields, "author mapping");
    if (!rules.mapping_modes.includes(policy.taxonomy_mapping.mode) || !rules.mapping_modes.includes(policy.author_mapping.mode)) fail("validation_failed");
    exactObject(policy.native_limit_policy, rules.native_limit_policy_required_fields, [], "native limit policy");
    if (!Number.isSafeInteger(policy.native_limit_policy.maximum_bytes) || policy.native_limit_policy.maximum_bytes < 1 || !rules.overflow_behaviors.includes(policy.native_limit_policy.overflow_behavior)) fail("validation_failed");
  }
  correlation(value.correlation_id, contract);
}

export function validateAuthenticationHeaders(value, contract) {
  exactObject(value, [contract.authentication.connection_header, contract.authentication.secret_header, contract.authentication.contract_header, contract.common.correlation_header], [], "authentication headers");
  pattern(value[contract.authentication.connection_header], contract.authentication.connection_id_pattern);
  nonblank(value[contract.authentication.secret_header], 4096, contract.authentication.secret_header);
  validateContractHeader(value, contract);
  correlation(value[contract.common.correlation_header], contract);
}

export function validateResolveRecord(record, contract) {
  exactObject(record, contract.resolve.required_fields, contract.resolve.optional_fields, "bridge_record");
  if (!contract.resolve.field_rules.direction.includes(record.direction)) fail("direction_denied");
  validatePresentationMode(record.presentation_mode, contract);
  nonblank(record.external_id, contract.resolve.field_rules.external_id_maximum_bytes, "external_id");
  nonblank(record.canonical_url, contract.resolve.field_rules.canonical_url_maximum_bytes, "canonical_url");
  nonblank(record.title, contract.resolve.field_rules.title_maximum_bytes, "title");
  if (bytes(record.content_html) > contract.resolve.field_rules.content_html_maximum_bytes) fail("validation_failed", "content_html too large");
  positiveInteger(record.source_revision_sequence, "source_revision_sequence");
  timestamp(record.source_created_at, "source_created_at");
  timestamp(record.source_updated_at, "source_updated_at");
  pattern(record.source_content_sha256, contract.common.sha256_pattern, "validation_failed", "source_content_sha256");
  if (!Number.isSafeInteger(record.source_content_bytes) || record.source_content_bytes < 0 || record.source_content_bytes > contract.resolve.source_content_maximum_bytes) fail("validation_failed", "source content bound");
  if (record.content_disposition === "complete") {
    if (Object.hasOwn(record, "read_more_url")) fail("validation_failed");
    if (bytes(record.content_html) !== record.source_content_bytes || sha256(record.content_html) !== record.source_content_sha256) fail("integrity_failed");
  } else if (record.content_disposition === "excerpt") {
    if (record.read_more_url !== record.canonical_url || !record.content_html.includes("Read More") || !record.content_html.includes(record.canonical_url)) fail("validation_failed");
    if (record.source_content_bytes <= bytes(record.content_html)) fail("validation_failed");
  } else fail("validation_failed");
  if (Object.hasOwn(record, "correlation_id")) correlation(record.correlation_id, contract);
}

export function validateResolveResponse(value, fields, contract) {
  exactObject(value, [...fields, "correlation_id"], [], "resolve response");
  correlation(value.correlation_id, contract);
  if (value.core_fallback !== false) fail("validation_failed");
}

export function validateRecord(record, contract) {
  exactObject(record, contract.records.required_record_fields, contract.records.optional_record_fields, "bridge record");
  positiveInteger(record.topic_id, "topic_id");
  positiveInteger(record.source_revision_sequence, "source_revision_sequence");
  timestamp(record.source_created_at, "source_created_at");
  timestamp(record.source_updated_at, "source_updated_at");
  if (!Array.isArray(record.bindings)) fail("validation_failed");
  for (const binding of record.bindings) {
    exactObject(binding, contract.records.destination_binding_fields, [], "destination binding");
    pattern(binding.binding_id, contract.records.binding_id_pattern);
    pattern(binding.connection_id, contract.authentication.connection_id_pattern);
    validatePresentationMode(binding.presentation_mode, contract);
  }
}

export function validateRecordIndex(value, contract) {
  exactObject(value, contract.records.index_required_response_fields, [], "record index");
  if (!Array.isArray(value.records) || value.records.length > contract.records.records_per_page) fail("validation_failed");
  for (const record of value.records) validateRecord(record, contract);
  positiveInteger(value.page, "page");
  positiveInteger(value.total_pages, "total_pages");
  correlation(value.correlation_id, contract);
}

export function validateRecordShow(value, contract) {
  exactObject(value, contract.records.show_required_response_fields, [], "record show");
  validateRecord(value.bridge_record, contract);
  correlation(value.correlation_id, contract);
}

export function validateInventory(value, contract) {
  exactObject(value, contract.source_publication.inventory.required_response_fields, [], "inventory");
  if (!Array.isArray(value.items) || value.items.length > contract.source_publication.inventory.maximum_limit) fail("validation_failed");
  for (const item of value.items) {
    exactObject(item, contract.source_publication.inventory.required_item_fields, [], "inventory item");
    positiveInteger(item.source_revision_sequence, "source_revision_sequence");
    timestamp(item.source_created_at, "source_created_at");
    timestamp(item.source_updated_at, "source_updated_at");
  }
  correlation(value.correlation_id, contract);
}

function validateTransport(transport, contract) {
  object(transport, "content_transport");
  if (transport.mode === "inline") {
    exactObject(transport, contract.source_publication.content_transport.inline.required_fields, [], "inline transport");
    if (bytes(transport.content_html) !== transport.byte_length || sha256(transport.content_html) !== transport.sha256) fail("integrity_failed");
    if (transport.byte_length > contract.source_publication.content_transport.inline.maximum_content_html_bytes) fail("validation_failed");
  } else if (transport.mode === "chunked") {
    exactObject(transport, contract.source_publication.content_transport.chunked.required_descriptor_fields, [], "chunked descriptor");
    if (!Number.isSafeInteger(transport.byte_length) || transport.byte_length > contract.source_publication.detail.maximum_source_content_bytes) fail("validation_failed");
    pattern(transport.sha256, contract.common.sha256_pattern);
    positiveInteger(transport.chunk_count, "chunk_count");
  } else fail("validation_failed");
}

export function validateSourceDetail(value, contract) {
  exactObject(value, contract.source_publication.detail.required_fields, [], "source detail");
  positiveInteger(value.source_revision_sequence, "source_revision_sequence");
  timestamp(value.source_created_at, "source_created_at");
  timestamp(value.source_updated_at, "source_updated_at");
  validatePresentationMode(value.presentation_mode, contract);
  if (!Array.isArray(value.source_authors) || value.source_authors.length > contract.source_publication.detail.source_authors_maximum_items) fail("validation_failed");
  if (!Array.isArray(value.categories) || value.categories.length > contract.source_publication.detail.categories_maximum_items) fail("validation_failed");
  if (!Array.isArray(value.tags) || value.tags.length > contract.source_publication.detail.tags_maximum_items) fail("validation_failed");
  for (const author of value.source_authors) exactObject(author, contract.authorship_and_taxonomy.source_author_fields, [], "source author");
  for (const category of value.categories) exactObject(category, contract.authorship_and_taxonomy.category_fields, [], "source category");
  for (const tag of value.tags) exactObject(tag, contract.authorship_and_taxonomy.tag_fields, [], "source tag");
  validateTransport(value.content_transport, contract);
  if (value.network_provenance !== null) validateNetwork(value.network_provenance, contract, null);
  correlation(value.correlation_id, contract);
}

export function validateChunk(value, descriptor, contract) {
  exactObject(value, contract.source_publication.content_transport.chunked.required_chunk_fields, ["correlation_id"], "content chunk");
  const decoded = Buffer.from(value.content_base64, "base64");
  if (decoded.length !== value.decoded_bytes || sha256(decoded) !== value.chunk_sha256) fail("integrity_failed");
  if (value.decoded_bytes > contract.source_publication.content_transport.chunked.decoded_chunk_maximum_bytes) fail("validation_failed");
  if (descriptor) {
    if (value.source_revision !== descriptor.source_revision || value.chunk_count !== descriptor.chunk_count) fail("revision_conflict");
  }
}

export function validateChunkSet(descriptor, chunks, contract) {
  const ordered = [...chunks].sort((a, b) => a.chunk - b.chunk);
  if (ordered.length !== descriptor.chunk_count) fail("integrity_failed");
  for (const chunk of ordered) validateChunk(chunk, descriptor, contract);
  const complete = Buffer.concat(ordered.map((chunk) => Buffer.from(chunk.content_base64, "base64")));
  if (complete.length !== descriptor.byte_length || sha256(complete) !== descriptor.sha256) fail("integrity_failed");
}

export function validateWork(value, contract) {
  exactObject(value, contract.publication_work.work_required_fields, [], "publication work");
  pattern(value.work_id, contract.publication_work.work_id_pattern);
  pattern(value.connection_id, contract.authentication.connection_id_pattern);
  pattern(value.lease_token, contract.publication_work.lease_token_pattern, "reconciliation_required", "lease_token");
  pattern(value.stage_token, contract.publication_work.stage_token_pattern, "stage_conflict", "stage_token");
  if (!contract.publication_work.actions.includes(value.action)) fail("validation_failed");
  validatePresentationMode(value.presentation_mode, contract);
  const mappingRules = contract.publication_work.resolved_mapping_rules;
  exactObject(value.resolved_container, mappingRules.container_required_fields, [], "resolved container");
  if (!Array.isArray(value.resolved_taxonomy)) fail("validation_failed");
  for (const item of value.resolved_taxonomy) exactObject(item, mappingRules.taxonomy_item_required_fields, [], "resolved taxonomy item");
  exactObject(value.resolved_author, mappingRules.author_required_fields, [], "resolved author");
  exactObject(value.native_limit_policy, mappingRules.native_limit_policy_required_fields, [], "native limit policy");
  if (!Number.isSafeInteger(value.native_limit_policy.maximum_bytes) || value.native_limit_policy.maximum_bytes < 1) fail("validation_failed");
  positiveInteger(value.source_revision_sequence, "source_revision_sequence");
  if (!Number.isSafeInteger(value.attempt_count) || value.attempt_count < 1 || value.attempt_count > contract.publication_work.maximum_total_attempts) fail("validation_failed");
  if (!Number.isSafeInteger(value.retry_generation) || value.retry_generation < 0) fail("validation_failed");
  timestamp(value.lease_expires_at, "lease_expires_at");
  correlation(value.correlation_id, contract);
}

export function validateClaimRequest(value, contract) {
  exactObject(value, contract.publication_work.claim.request_required_fields, contract.publication_work.claim.request_optional_fields, "claim request");
  nonblank(value.worker_id, contract.publication_work.worker_id_maximum_bytes, "worker_id");
  if (Object.hasOwn(value, "maximum_items") && (!Number.isSafeInteger(value.maximum_items) || value.maximum_items < 1 || value.maximum_items > contract.publication_work.claim.maximum_items)) fail("validation_failed");
  if (Object.hasOwn(value, "requested_lease_seconds") && (!Number.isSafeInteger(value.requested_lease_seconds) || value.requested_lease_seconds < 1 || value.requested_lease_seconds > contract.publication_work.claim.maximum_requested_lease_seconds)) fail("validation_failed");
  correlation(value.correlation_id, contract);
}

export function validateClaimResponse(value, contract) {
  exactObject(value, contract.publication_work.claim.response_required_fields, [], "claim response");
  if (!Array.isArray(value.publication_work) || value.publication_work.length > contract.publication_work.claim.maximum_items) fail("validation_failed");
  for (const item of value.publication_work) validateWork(item, contract);
  timestamp(value.claimed_at, "claimed_at");
  correlation(value.correlation_id, contract);
}

export function validateRenewal(value, contract) {
  exactObject(value.request, contract.publication_work.renew.required_fields, [], "renewal request");
  exactObject(value.response, contract.publication_work.renew.response_required_fields, [], "renewal response");
  pattern(value.request.lease_token, contract.publication_work.lease_token_pattern, "reconciliation_required", "lease_token");
  if (!Number.isSafeInteger(value.request.requested_lease_seconds) || value.request.requested_lease_seconds < 1 || value.request.requested_lease_seconds > contract.publication_work.claim.maximum_requested_lease_seconds) fail("validation_failed");
  pattern(value.response.work_id, contract.publication_work.work_id_pattern);
  timestamp(value.response.lease_expires_at, "lease_expires_at");
  validateLeaseRenewal(0, value.response.total_lease_seconds, contract.publication_work.claim.maximum_total_lease_seconds);
  if (value.request.correlation_id !== value.response.correlation_id) fail("validation_failed");
}

export function validateAcknowledgement(value, contract) {
  exactObject(value, contract.publication_work.acknowledgement.required_fields, contract.publication_work.acknowledgement.conditional_fields, "acknowledgement");
  pattern(value.lease_token, contract.publication_work.lease_token_pattern, "reconciliation_required", "lease_token");
  pattern(value.stage_token, contract.publication_work.stage_token_pattern, "stage_conflict", "stage_token");
  if (!contract.publication_work.acknowledgement.stages.includes(value.stage)) fail("stage_conflict");
  if (!contract.publication_work.actions.includes(value.action)) fail("validation_failed");
  timestamp(value.synchronized_at, "synchronized_at");
  if (value.stage === "synchronized") {
    if (value.deployment_state === "not_required") {
      if (value.verification_state !== "not_required") fail("validation_failed");
    } else if (value.deployment_state !== "pending" || value.verification_state !== "pending") fail("validation_failed");
    if (Object.hasOwn(value, "deployed_at") || Object.hasOwn(value, "publicly_verified_at")) fail("validation_failed");
  } else if (value.stage === "deployed") {
    if (value.deployment_state !== "deployed" || value.verification_state !== "pending") fail("validation_failed");
    timestamp(value.deployed_at, "deployed_at");
    if (Object.hasOwn(value, "publicly_verified_at")) fail("validation_failed");
  } else {
    if (value.deployment_state !== "deployed" || value.verification_state !== "verified") fail("validation_failed");
    timestamp(value.deployed_at, "deployed_at");
    timestamp(value.publicly_verified_at, "publicly_verified_at");
  }
  exactObject(value.destination_binding, ["binding_id", "external_id", "canonical_url", "publication_revision", "content_disposition"], [], "destination_binding");
  pattern(value.destination_binding.binding_id, contract.records.binding_id_pattern);
  for (const field of ["external_id", "canonical_url", "publication_revision"]) nonblank(value.destination_binding[field], 2048, `destination_binding.${field}`);
  if (!["complete", "excerpt"].includes(value.destination_binding.content_disposition)) fail("validation_failed");
  correlation(value.correlation_id, contract);
}

export function validateStageTransition(previous, next) {
  const order = ["synchronized", "deployed", "verified"];
  if (order.indexOf(next.stage) !== order.indexOf(previous.stage) + 1) fail("stage_conflict");
  for (const field of ["resource_id", "source_revision", "source_revision_sequence", "policy_revision", "destination_policy_id", "action"]) {
    if (canonicalize(previous[field]) !== canonicalize(next[field])) fail("revision_conflict");
  }
  if (canonicalize(previous.destination_binding) !== canonicalize(next.destination_binding)) fail("identity_conflict");
  if (previous.stage_token === next.stage_token) fail("stage_conflict");
}

export function validateAcknowledgementResponse(value, contract) {
  exactObject(value, contract.publication_work.acknowledgement.response_required_fields, contract.publication_work.acknowledgement.response_conditional_fields, "acknowledgement response");
  pattern(value.work_id, contract.publication_work.work_id_pattern);
  if (!contract.publication_work.acknowledgement.stages.includes(value.accepted_stage)) fail("stage_conflict");
  if (typeof value.terminal !== "boolean") fail("validation_failed");
  if (value.terminal) {
    if (value.resulting_state !== "acknowledged" || Object.hasOwn(value, "next_stage_token")) fail("stage_conflict");
  } else {
    if (!Object.hasOwn(value, "next_stage_token")) fail("stage_conflict");
    pattern(value.next_stage_token, contract.publication_work.stage_token_pattern, "stage_conflict", "next_stage_token");
    const expected = value.accepted_stage === "synchronized" ? "awaiting_deployment" : "awaiting_verification";
    if (value.resulting_state !== expected) fail("stage_conflict");
  }
  correlation(value.correlation_id, contract);
}

export function validateFailure(value, contract) {
  exactObject(value, contract.publication_work.failure.required_fields, [], "failure");
  pattern(value.lease_token, contract.publication_work.lease_token_pattern, "reconciliation_required", "lease_token");
  if (![...contract.failure_registry.retryable, ...contract.failure_registry.terminal].includes(value.error_code)) fail("validation_failed");
  if (bytes(value.error_detail) > contract.common.error_detail_maximum_bytes) fail("validation_failed");
  timestamp(value.failed_at, "failed_at");
  correlation(value.correlation_id, contract);
}

export function validateCatalogSegment(value, contract) {
  exactObject(value, contract.platform_catalog.get_required_response_fields, [], "catalog segment");
  if (!contract.platform_catalog.segment_types.includes(value.segment_type)) fail("validation_failed");
  if (!Array.isArray(value.items) || value.items.length > contract.platform_catalog.maximum_items_per_segment) fail("validation_failed");
  const fields = contract.platform_catalog.item_schemas[value.segment_type];
  const ids = new Set();
  for (const item of value.items) {
    exactObject(item, fields, [], `${value.segment_type} item`);
    nonblank(item.id, 255, "catalog item id");
    if (ids.has(item.id)) fail("validation_failed");
    ids.add(item.id);
    if (typeof item.available !== "boolean") fail("validation_failed");
    if (value.segment_type === "native_limits" && (!Number.isSafeInteger(item.maximum_bytes) || item.maximum_bytes < 1 || !["complete", "excerpt_with_read_more", "operator_attention"].includes(item.overflow_behavior))) fail("validation_failed");
  }
  correlation(value.correlation_id, contract);
}

export function validateCatalogUpdate(value, contract, currentRevision = null) {
  exactObject(value.request, contract.platform_catalog.put_required_request_fields, [], "catalog update request");
  exactObject(value.response, contract.platform_catalog.put_required_response_fields, [], "catalog update response");
  if (value.request.correlation_id !== value.response.correlation_id) fail("validation_failed");
  if (currentRevision !== null && value.request.base_catalog_revision !== currentRevision) fail("catalog_revision_conflict");
  for (const segment of value.request.segments) {
    exactObject(segment, contract.platform_catalog.segment_required_fields, [], "catalog update segment");
    if (!contract.platform_catalog.segment_types.includes(segment.segment_type)) fail("validation_failed");
  }
}

export function validateCatalogCursor(request, binding) {
  for (const field of ["connection_id", "platform_profile", "segment_type", "catalog_revision"]) {
    if (request[field] !== binding[field]) fail("cursor_snapshot_mismatch");
  }
}

export function validateRevocationCursor(request, binding) {
  for (const field of ["connection_id", "high_water", "policy_revision"]) {
    if (request[field] !== binding[field]) fail("cursor_snapshot_mismatch");
  }
}

export function validateResolvedPolicy(policy, catalogItems) {
  const available = new Map(catalogItems.map((item) => [item.id, item.available]));
  for (const mapping of [policy.container_mapping, ...(policy.taxonomy_mapping?.items ?? []), ...(policy.author_mapping?.items ?? [])]) {
    if (mapping?.destination && available.get(mapping.destination) !== true) fail("policy_denied");
  }
}

export function validateRevocationDetail(value, contract) {
  exactObject(value, contract.source_publication.revocations.detail_required_fields, [], "revocation detail");
  pattern(value.revocation_id, contract.source_publication.revocations.revocation_id_pattern);
  if (!contract.source_publication.revocations.reasons.includes(value.reason)) fail("validation_failed");
  timestamp(value.effective_at, "effective_at");
  correlation(value.correlation_id, contract);
}

export function validateRevocationIndex(value, contract) {
  exactObject(value, contract.source_publication.revocations.index_required_fields, [], "revocation index");
  if (!Array.isArray(value.items) || value.items.length > contract.source_publication.revocations.maximum_limit) fail("validation_failed");
  for (const item of value.items) {
    exactObject(item, contract.source_publication.revocations.item_required_fields, [], "revocation item");
    pattern(item.revocation_id, contract.source_publication.revocations.revocation_id_pattern);
    if (!contract.source_publication.revocations.reasons.includes(item.reason)) fail("validation_failed");
  }
  correlation(value.correlation_id, contract);
}

export function validateErrorResponse(value, contract, protectedValues = []) {
  exactObject(value, contract.error_responses.required_fields, [], "error response");
  correlation(value.correlation_id, contract);
  if (bytes(value.message) > contract.common.error_detail_maximum_bytes) fail("validation_failed");
  for (const protectedValue of protectedValues) if (protectedValue && value.message.includes(protectedValue)) fail("secret_exposure");
  if (!Object.values(contract.error_responses.statuses).flat().includes(value.error_code)) fail("validation_failed");
}

export function validateNetwork(value, contract, localForumId) {
  exactObject(value, contract.discourse_network.required_provenance_fields, [], "network provenance");
  if (!contract.discourse_network.relationships.includes(value.relationship)) fail("direction_denied");
  if (!contract.discourse_network.managed_scopes.includes(value.managed_scope)) fail("scope_denied");
  if (!Array.isArray(value.route_forum_ids) || value.route_forum_ids.length > contract.discourse_network.route_maximum_forums || new Set(value.route_forum_ids).size !== value.route_forum_ids.length) fail("validation_failed");
  if (localForumId && value.origin_forum_id === localForumId) fail("direction_denied");
  if (localForumId && value.route_forum_ids.includes(localForumId)) fail("scope_denied");
}

export function validateNetworkRoute(value, contract) {
  exactObject(value, ["authenticated_sender_forum_id", "local_forum_id", "authorized_peer", "route_before", "route_after", "correlation_id"], [], "network route append");
  if (value.authorized_peer !== true) fail("direction_denied");
  if (!Array.isArray(value.route_before) || !Array.isArray(value.route_after) || value.route_before.length === 0) fail("validation_failed");
  if (value.route_before.at(-1) !== value.authenticated_sender_forum_id) fail("direction_denied");
  if (value.route_before.includes(value.local_forum_id)) fail("scope_denied");
  if (canonicalize(value.route_after) !== canonicalize([...value.route_before, value.local_forum_id])) fail("validation_failed");
  if (value.route_after.length > contract.discourse_network.route_maximum_forums) fail("validation_failed");
  correlation(value.correlation_id, contract);
}

export function validateReplay(stored, replay) {
  for (const field of ["origin_forum_id", "operation_id", "source_revision", "content_sha256", "route_forum_ids", "relationship", "managed_scope", "policy_revision"]) {
    if (canonicalize(stored[field]) !== canonicalize(replay[field])) fail("operation_replay_mismatch");
  }
}

export function validateForumClone(existingForumId, cloneForumId, rotatedAndReauthorized) {
  if (existingForumId === cloneForumId && rotatedAndReauthorized !== true) fail("identity_conflict");
}

export function validateOperatorEntitlement(entitlement, operator, trust, context = {}) {
  exactObject(entitlement, operator.entitlement.required_fields, [], "operator entitlement");
  if (entitlement.entitlement_version !== operator.entitlement.entitlement_version) fail("entitlement_invalid_signature");
  pattern(entitlement.entitlement_id, operator.entitlement.entitlement_id_pattern, "entitlement_invalid_signature");
  pattern(entitlement.provider_id, operator.entitlement.provider_id_pattern, "entitlement_invalid_signature");
  pattern(entitlement.forum_id, operator.entitlement.forum_id_pattern, "entitlement_invalid_signature");
  pattern(entitlement.issuer_id, operator.entitlement.issuer_id_pattern, "entitlement_invalid_signature");
  nonblank(entitlement.provider_name, operator.entitlement.provider_name_maximum_bytes, "provider_name");
  nonblank(entitlement.key_id, operator.entitlement.key_id_maximum_bytes, "key_id");
  if (!Array.isArray(entitlement.scopes) || entitlement.scopes.length === 0) fail("scope_denied");
  const signature = entitlement.signature;
  if (!base64urlPattern.test(signature) || signature.includes("=") || Buffer.from(signature, "base64url").length !== operator.entitlement.signature_decoded_bytes) fail("entitlement_invalid_signature");
  const trustKey = trust?.[`${entitlement.issuer_id}:${entitlement.key_id}`];
  if (!trustKey || !base64urlPattern.test(trustKey)) fail("entitlement_invalid_signature");
  const raw = Buffer.from(trustKey, "base64url");
  if (raw.length !== 32) fail("entitlement_invalid_signature");
  const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]), format: "der", type: "spki" });
  const unsigned = structuredClone(entitlement);
  delete unsigned.signature;
  const message = Buffer.from(`${operator.entitlement.signing_domain}${canonicalize(unsigned)}`, "utf8");
  if (!verify(null, message, publicKey, Buffer.from(signature, "base64url"))) fail("entitlement_invalid_signature");
  for (const scope of entitlement.scopes) if (!operator.entitlement.allowed_scopes.includes(scope)) fail("scope_denied");
  for (const field of ["issued_at", "not_before", "expires_at", "grace_until"]) timestamp(entitlement[field], field);
  if (Date.parse(entitlement.not_before) < Date.parse(entitlement.issued_at)) fail("validation_failed");
  if (Date.parse(entitlement.expires_at) <= Date.parse(entitlement.not_before) || (Date.parse(entitlement.expires_at) - Date.parse(entitlement.issued_at)) / 1000 > operator.entitlement.maximum_lifetime_seconds) fail("validation_failed");
  if (Date.parse(entitlement.grace_until) < Date.parse(entitlement.expires_at) || (Date.parse(entitlement.grace_until) - Date.parse(entitlement.expires_at)) / 1000 > operator.entitlement.maximum_grace_seconds) fail("validation_failed");
  if (context.forumId && context.forumId !== entitlement.forum_id) fail("entitlement_wrong_forum");
  if (context.state === "revoked") fail("entitlement_revoked");
  if (context.state === "replaced") fail("entitlement_replaced");
  if (context.at && Date.parse(context.at) < Date.parse(entitlement.not_before)) fail("entitlement_not_yet_valid");
  if (context.at && Date.parse(context.at) > Date.parse(entitlement.grace_until)) fail("entitlement_expired");
  if (context.at && Date.parse(context.at) > Date.parse(entitlement.expires_at) && context.mutation === true) fail("scope_denied");
}

export function validateRevisionTransition(stored, incoming) {
  if (incoming.source_revision_sequence < stored.source_revision_sequence) fail("revision_conflict");
  if (incoming.source_revision_sequence === stored.source_revision_sequence && (incoming.source_revision !== stored.source_revision || incoming.source_content_sha256 !== stored.source_content_sha256)) fail("reconciliation_required");
}

export function validateDirection(connection, request) {
  if (!connection.directions.includes(request.direction)) fail("direction_denied");
}

export function validateScope(connection, request) {
  if (!connection.lanes.includes(request.lane)) fail("scope_denied");
}

export function validateLeaseTime(leaseExpiresAt, receivedAt) {
  if (Date.parse(receivedAt) > Date.parse(leaseExpiresAt)) fail("work_expired");
}

export function validateLeaseRenewal(current, requested, maximum) {
  if (current + requested > maximum) fail("lease_limit_exceeded");
}

export function validateCursorSnapshot(request, binding) {
  if (request.snapshot !== binding.snapshot) fail("cursor_snapshot_mismatch");
}

export function validateIdentity(stored, incoming) {
  if (stored.canonical_url === incoming.canonical_url && stored.external_id !== incoming.external_id) fail("identity_conflict");
}

export function validateAcknowledgementIdentity(work, acknowledgement, state = "leased") {
  if (state === "superseded") fail("work_superseded");
  if (work.source_revision !== acknowledgement.source_revision || work.source_revision_sequence !== acknowledgement.source_revision_sequence || work.policy_revision !== acknowledgement.policy_revision) fail("revision_conflict");
}

export function validateUrlProof(value) {
  if (!value.transitions.length || value.transitions.at(-1).new_url !== value.to_url) fail("reconciliation_required");
  if (value.transitions[0].old_url !== value.from_url) fail("reconciliation_required");
  for (let index = 1; index < value.transitions.length; index += 1) {
    if (value.transitions[index - 1].new_url !== value.transitions[index].old_url) fail("reconciliation_required");
  }
}

export function validateUrlProofResponse(value, contract) {
  exactObject(value, contract.records.source_url_migration_attestation.required_response_fields, [], "source URL proof");
  if (!Array.isArray(value.transitions) || value.transitions.length > contract.records.source_url_migration_attestation.maximum_transitions) fail("validation_failed");
  for (const transition of value.transitions) {
    exactObject(transition, contract.records.source_url_migration_attestation.transition_required_fields, [], "source URL transition");
    if (!contract.records.source_url_migration_attestation.permanent_redirect_statuses.includes(transition.redirect_status)) fail("reconciliation_required");
    timestamp(transition.verified_at, "transition.verified_at");
  }
  if (value.transition_count !== value.transitions.length) fail("validation_failed");
  timestamp(value.verified_at, "verified_at");
  correlation(value.correlation_id, contract);
  validateUrlProof(value);
}

export function validateOperatorAudit(value, operator) {
  exactObject(value, operator.audit.required_fields, [], "operator audit");
  pattern(value.event_id, operator.audit.event_id_pattern);
  pattern(value.operation_sha256, operator.audit.operation_sha256_pattern);
  timestamp(value.occurred_at, "occurred_at");
  if (!operator.audit.outcomes.includes(value.outcome)) fail("validation_failed");
}

export function validateDestinationCollision(value) {
  if (value.to_url === value.existing_binding.canonical_url && value.moving_resource_id !== value.existing_binding.resource_id) fail("destination_collision");
}

export function validateRetiredUrl(value) {
  if (value.to_url === value.retired_binding.canonical_url && value.retired_binding.state === "retired" && value.moving_resource_id !== value.retired_binding.resource_id) fail("url_retired");
}

export function validateContractHeader(headers, contract) {
  if (headers[contract.authentication.contract_header] !== contract.authentication.contract_header_value) fail("validation_failed");
}

export function validateEntitlementTime(value) {
  if (Date.parse(value.request_at) > Date.parse(value.entitlement.grace_until)) fail("entitlement_expired");
}

export function validateCutoverManifest(value, contract) {
  exactObject(value, ["manifest_id", "adapter_protocol", "shared_plugin", "adapters", "receiver_schema", "configuration_revision", "policy_revisions", "consumer_identities", "correlation_id"], [], "cutover manifest");
  exactObject(value.adapter_protocol, ["version", "sha256"], [], "adapter protocol artifact");
  exactObject(value.shared_plugin, ["version", "sha256"], [], "shared plugin artifact");
  if (!Array.isArray(value.adapters) || value.adapters.length === 0) fail("validation_failed");
  for (const adapter of value.adapters) exactObject(adapter, ["profile", "version", "sha256"], [], "adapter artifact");
  for (const artifact of [value.adapter_protocol, value.shared_plugin, ...value.adapters]) pattern(artifact.sha256, contract.common.sha256_pattern);
  if (value.adapter_protocol.version !== contract.version) fail("validation_failed");
  correlation(value.correlation_id, contract);
}
