import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ProtocolError, canonicalize, validateAcknowledgementExchange,
  validateAcknowledgementIdentity, validateClaimResponse, validateClaimResponseText,
  validateRenewal, validateStageTransition, validateStaticRecoveryClaim,
  validateStaticRecoveryTransition, validateWork, validateWorkText,
} from "./protocol-validation.mjs";

export async function validateStaticRecoveryConformance(contract) {
  const load = async name => JSON.parse(await readFile(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
  const trace = await load("static-recovery/trace.json");
  const originalClaim = await load(trace.original_claim);
  const responses = await load(trace.responses);
  const copy = structuredClone;
  let positives = 0;
  let negatives = 0;
  const positive = (label, fn) => { assert.doesNotThrow(fn, label); positives++; };
  const negative = (label, code, fn) => {
    assert.throws(fn, error => error instanceof ProtocolError && error.code === code, label);
    negatives++;
  };
  const headers = ack => ({ request_header: ack.correlation_id, response_header: ack.correlation_id });
  const build = async (entry, disposition = "complete") => {
    // Receiver receipt input is loaded independently of the emitted claim. It
    // represents persisted history in this fixture, not database proof.
    const previous = await load(entry.receipt_acknowledgement);
    previous.synchronized_at = "2026-09-27T18:31:00.123456789Z";
    if (previous.deployed_at) previous.deployed_at = "2026-09-27T18:31:30.123456789Z";
    previous.destination_binding.content_disposition = disposition;
    if (disposition === "excerpt") previous.destination_binding.read_more_url = trace.excerpt_source_url;
    const receipt = { receipt_id: `receipt:${entry.receipt_response}:1`, acknowledgement: copy(previous), response: copy(responses[entry.receipt_response]) };
    const work = { ...copy(originalClaim.publication_work[0]), lease_token: entry.lease_token, stage_token: entry.stage_token,
      lease_expires_at: trace.lease_expires_at, correlation_id: entry.correlation_id,
      static_recovery: { state: entry.state, acknowledgement: copy(previous), response: copy(receipt.response) } };
    const issue = { work_id: work.work_id, lease_token: work.lease_token, stage_token: work.stage_token,
      claimed_at: trace.claimed_at, lease_expires_at: work.lease_expires_at, state: entry.state,
      receipt_id: receipt.receipt_id, active: true, attempt_count: work.attempt_count, retry_generation: work.retry_generation };
    const authority = Object.fromEntries(["connection_id", "resource_id", "source_revision", "source_revision_sequence", "policy_revision", "destination_policy_id", "catalog_revision"].map(field => [field, work[field]]));
    Object.assign(authority, { visible: true, enabled: true, in_scope: true, policy_available: true, destination_owned: true });
    const context = { destination_mode: "static", claimed_at: trace.claimed_at, received_at: trace.received_at,
      current_issue: issue, accepted_receipt: receipt, authority };
    if (disposition === "excerpt") context.source_reference = { resource_id: work.resource_id, source_revision: work.source_revision,
      source_revision_sequence: work.source_revision_sequence, topic_url: trace.excerpt_source_url };
    const claimContext = { destination_mode: "static", claimed_at: trace.claimed_at, current_issue: copy(issue),
      accepted_receipt: copy(receipt), authority: copy(authority), previous_state: entry.state,
      previous_issue: { lease_token: previous.lease_token, stage_token: receipt.response.next_stage_token,
        lease_expires_at: originalClaim.publication_work[0].lease_expires_at, active: true } };
    const next = await load(entry.next_acknowledgement);
    Object.assign(next, { lease_token: work.lease_token, stage_token: work.stage_token,
      synchronized_at: previous.synchronized_at, destination_binding: copy(previous.destination_binding), correlation_id: entry.correlation_id });
    // The operation may actually have succeeded before the recovery claim and
    // lost its ACK; retain its event time rather than fabricate a later one.
    next.deployed_at = previous.deployed_at ?? "2026-09-27T18:39:00.123456789Z";
    if (next.stage === "verified") next.publicly_verified_at = "2026-09-27T18:39:30.123456789Z";
    const response = { ...copy(responses[entry.next_response]), correlation_id: next.correlation_id };
    return { work, previous, receipt, context, claimContext, next, response };
  };
  const models = [];
  for (const entry of trace.cases) {
    for (const disposition of ["complete", "excerpt"]) {
      const model = await build(entry, disposition);
      models.push(model);
      const { work, next, response, context, claimContext, previous, receipt } = model;
      const before = canonicalize(model);
      positive(`${entry.state}/${disposition}: shape`, () => validateWork(work, contract));
      positive(`${entry.state}/${disposition}: actual receipt claim`, () => validateStaticRecoveryClaim(work, contract, claimContext));
      positive(`${entry.state}/${disposition}: transition`, () => validateStaticRecoveryTransition(work, next, contract, entry.state, context));
      positive(`${entry.state}/${disposition}: direct identity`, () => validateAcknowledgementIdentity(work, next, entry.state, context, contract));
      positive(`${entry.state}/${disposition}: correlated exchange`, () => validateAcknowledgementExchange(work, next, response, contract, entry.state, context, headers(next)));
      positive(`${entry.state}/${disposition}: bounded claim`, () => validateClaimResponse({ publication_work: [work], claimed_at: trace.claimed_at, correlation_id: work.correlation_id }, contract));
      negative("ordinary old receipt does NOT authorize the new recovery token", "stage_conflict", () => validateStageTransition(previous, next, receipt.response));
      assert.equal(canonicalize(model), before, "validators cannot rewrite receipts, counters, native identity or source content");
      for (const profile of trace.profiles) {
        const scoped = copy(model);
        scoped.work.destination_policy_id = `destination:${profile}:primary:1`;
        scoped.work.catalog_revision = `catalog:${profile}:2026-09-27:1`;
        scoped.work.static_recovery.acknowledgement.destination_policy_id = scoped.work.destination_policy_id;
        scoped.claimContext.accepted_receipt.acknowledgement.destination_policy_id = scoped.work.destination_policy_id;
        scoped.claimContext.authority.destination_policy_id = scoped.work.destination_policy_id;
        scoped.claimContext.authority.catalog_revision = scoped.work.catalog_revision;
        positive(`${profile}: same shared recovery schema`, () => validateStaticRecoveryClaim(scoped.work, contract, scoped.claimContext));
      }
      const claimText = JSON.stringify({ publication_work: [work], claimed_at: trace.claimed_at, correlation_id: work.correlation_id });
      const rawWork = JSON.stringify(work);
      const bound = contract.publication_work.maximum_json_bytes;
      positive("raw recovered work at exact original bound", () => validateWorkText(rawWork + " ".repeat(bound - Buffer.byteLength(rawWork)), contract));
      negative("raw recovered work at bound plus one", "validation_failed", () => validateWorkText(rawWork + " ".repeat(bound + 1 - Buffer.byteLength(rawWork)), contract));
      const prefix = claimText.indexOf(rawWork);
      const envelope = Buffer.byteLength(claimText) - Buffer.byteLength(rawWork);
      positive("recovered claim envelope at exact bound", () => validateClaimResponseText(claimText + " ".repeat(contract.publication_work.claim.envelope_maximum_json_bytes - envelope), contract));
      negative("recovered claim envelope plus one", "validation_failed", () => validateClaimResponseText(claimText + " ".repeat(contract.publication_work.claim.envelope_maximum_json_bytes + 1 - envelope), contract));
      negative("oversized recovered item within whole-response bound", "validation_failed", () => validateClaimResponseText(claimText.slice(0, prefix) + rawWork + " ".repeat(bound + 1 - Buffer.byteLength(rawWork)) + claimText.slice(prefix + rawWork.length), contract));
      if (entry.state === "awaiting_deployment") {
        const verified = await load("publication-acknowledgement.json");
        Object.assign(verified, { lease_token: work.lease_token, stage_token: response.next_stage_token,
          synchronized_at: next.synchronized_at, deployed_at: next.deployed_at,
          publicly_verified_at: "2026-09-27T18:41:30.123456789Z", destination_binding: copy(next.destination_binding), correlation_id: "static-ordinary-verification-01" });
        const ordinaryWork = { ...copy(work), stage_token: response.next_stage_token };
        delete ordinaryWork.static_recovery;
        const ordinaryContext = { destination_mode: "static", received_at: "2026-09-27T18:42:00.123456789Z" };
        if (context.source_reference) ordinaryContext.source_reference = copy(context.source_reference);
        positive("after recovered deployment, ordinary verification chain", () => {
          validateStageTransition(next, verified, response);
          validateAcknowledgementExchange(ordinaryWork, verified, { ...copy(responses.verified), correlation_id: verified.correlation_id }, contract, "awaiting_verification", ordinaryContext, headers(verified));
        });
      }
    }
  }
  for (const model of models) {
    const { work, next, context, claimContext } = model;
    const mutateTransition = (label, code, mutate) => {
      const changed = copy(model); mutate(changed);
      const before = canonicalize(changed);
      negative(label, code, () => validateStaticRecoveryTransition(changed.work, changed.next, contract, work.static_recovery.state, changed.context));
      assert.equal(canonicalize(changed), before, "denial cannot mutate input state");
    };
    const mutateClaim = (label, code, mutate) => {
      const changed = copy(model); mutate(changed);
      negative(label, code, () => validateStaticRecoveryClaim(changed.work, contract, changed.claimContext));
    };
    mutateTransition("dynamic pending recovery", "reconciliation_required", m => m.context.destination_mode = "dynamic");
    mutateTransition("absent actual receipt", "validation_failed", m => delete m.context.accepted_receipt);
    mutateTransition("invented but shaped receipt", "integrity_failed", m => m.work.static_recovery.acknowledgement.destination_binding.external_id = "invented:object");
    mutateTransition("altered historical response", "integrity_failed", m => m.work.static_recovery.response.next_stage_token = "9".repeat(64));
    mutateTransition("other actual receipt association", "reconciliation_required", m => m.context.current_issue.receipt_id = "another-receipt");
    mutateTransition("inactive ownership", "lease_conflict", m => m.context.current_issue.active = false);
    mutateTransition("old ownership issue", "reconciliation_required", m => m.context.current_issue.lease_token = "a".repeat(64));
    mutateTransition("old acknowledgement lease token", "reconciliation_required", m => m.next.lease_token = m.previous.lease_token);
    mutateTransition("old acknowledgement stage token", "stage_conflict", m => m.next.stage_token = m.receipt.response.next_stage_token);
    mutateTransition("synchronization not authorized by recovery", "stage_conflict", m => m.next = copy(m.previous));
    mutateTransition("changed destination binding", "identity_conflict", m => m.next.destination_binding.external_id += "-changed");
    mutateTransition("raw synchronization timestamp changed without changing instant", "identity_conflict", m => m.next.synchronized_at = m.next.synchronized_at.replace("Z", "0Z"));
    if (next.stage === "verified") mutateTransition("raw deployment timestamp changed", "identity_conflict", m => m.next.deployed_at = m.next.deployed_at.replace("Z", "0Z"));
    mutateTransition("changed source revision", "revision_conflict", m => m.next.source_revision = "post:12:version:5");
    mutateTransition("changed destination policy", "revision_conflict", m => m.next.destination_policy_id = "destination:other:1");
    mutateTransition("event after receiver receipt", "validation_failed", m => m.next[m.next.stage === "deployed" ? "deployed_at" : "publicly_verified_at"] = "2026-09-27T18:42:00Z");
    mutateTransition("event before preceding accepted event", "validation_failed", m => m.next[m.next.stage === "deployed" ? "deployed_at" : "publicly_verified_at"] = "2026-09-27T18:30:00Z");
    mutateTransition("expired recovery ACK", "work_expired", m => m.context.received_at = "2026-09-27T18:45:01Z");
    mutateTransition("expiry boundary is no longer an unexpired recovery lease", "work_expired", m => m.context.received_at = m.work.lease_expires_at);
    mutateTransition("receipt before ownership issue", "validation_failed", m => m.context.received_at = "2026-09-27T18:39:59Z");
    mutateTransition("unknown recovery field", "unknown_field", m => m.work.static_recovery.native_write = true);
    mutateTransition("unknown historical ACK field", "unknown_field", m => m.work.static_recovery.acknowledgement.scope = "all");
    mutateTransition("terminal historical receipt", "reconciliation_required", m => m.work.static_recovery.response = copy(responses.verified));
    mutateTransition("retained response for another work", "identity_conflict", m => m.work.static_recovery.response.work_id = `dbw_${"9".repeat(32)}`);
    mutateTransition("retained response correlation changed", "integrity_failed", m => m.work.static_recovery.response.correlation_id = "invented-history");
    mutateTransition("retained source revision changed", "reconciliation_required", m => m.work.static_recovery.acknowledgement.source_revision += ":new");
    mutateTransition("retained destination policy changed", "reconciliation_required", m => m.work.static_recovery.acknowledgement.destination_policy_id += ":new");
    mutateTransition("reuse historical ownership lease", "reconciliation_required", m => m.work.lease_token = m.previous.lease_token);
    mutateTransition("reuse historical next-stage token", "reconciliation_required", m => m.work.stage_token = m.receipt.response.next_stage_token);
    if (next.stage === "deployed") {
      const skipped = await load("publication-acknowledgement.json");
      Object.assign(skipped, { lease_token: work.lease_token, stage_token: work.stage_token,
        synchronized_at: next.synchronized_at, deployed_at: next.deployed_at,
        publicly_verified_at: "2026-09-27T18:40:30Z", destination_binding: copy(next.destination_binding) });
      negative("valid-shaped verification skips deployment", "stage_conflict", () => validateStaticRecoveryTransition(work, skipped, contract, work.static_recovery.state, context));
    }
    if (next.destination_binding.content_disposition === "excerpt") {
      mutateTransition("recovered excerpt Read More changed", "identity_conflict", m => m.next.destination_binding.read_more_url += "/changed");
      const wrongSourceContext = copy(context);
      wrongSourceContext.source_reference.topic_url += "/changed";
      negative("excerpt exact target uses receiver source reference", "identity_conflict", () => validateAcknowledgementExchange(work, next, model.response, contract, work.static_recovery.state, wrongSourceContext, headers(next)));
    }
    mutateTransition("changed counter at the receiver issue", "reconciliation_required", m => m.context.current_issue.attempt_count++);
    mutateTransition("changed retry generation", "reconciliation_required", m => m.context.current_issue.retry_generation++);
    negative("superseded recovery ACK", "work_superseded", () => validateStaticRecoveryTransition(work, next, contract, "superseded", context));
    negative("skip state cannot escape recovery identity branch", "stage_conflict", () => validateAcknowledgementIdentity(work, next, "acknowledged", context, contract));
    negative("recovery identity without controlling contract", "reconciliation_required", () => validateAcknowledgementIdentity(work, next, work.static_recovery.state, context));
    for (const field of ["visible", "enabled", "in_scope", "policy_available", "destination_owned"]) {
      mutateClaim(`claim denies current ${field}`, "reconciliation_required", m => m.claimContext.authority[field] = false);
      mutateTransition(`ACK denies current ${field}`, "reconciliation_required", m => m.context.authority[field] = false);
    }
    mutateClaim("current revision/policy supersedes recovery", "work_superseded", m => m.claimContext.authority.policy_revision += ":new");
    mutateClaim("live owner cannot be displaced", "lease_conflict", m => m.claimContext.previous_issue.lease_expires_at = "2026-09-27T18:50:00Z");
    mutateClaim("fresh claim must rotate both prior tokens", "reconciliation_required", m => m.claimContext.previous_issue.stage_token = m.work.stage_token);
    mutateClaim("retry_wait is not available before its due transition", "reconciliation_required", m => m.claimContext.previous_state = "retry_wait");
    mutateClaim("terminal attention is not generic retry authority", "reconciliation_required", m => m.claimContext.previous_state = "operator_attention");
    mutateClaim("unbounded initial recovery grant", "lease_limit_exceeded", m => { m.work.lease_expires_at = "2026-09-27T19:41:00Z"; m.claimContext.current_issue.lease_expires_at = m.work.lease_expires_at; });
    const retry = copy(claimContext);
    retry.previous_state = "available";
    retry.previous_issue.active = false;
    positive("receiver-released actual retry resumes retained stage", () => validateStaticRecoveryClaim(work, contract, retry));
    const repeated = copy(model);
    repeated.claimContext.previous_issue = { lease_token: work.lease_token, stage_token: work.stage_token, lease_expires_at: work.lease_expires_at, active: true };
    repeated.work.lease_token = "a".repeat(64); repeated.work.stage_token = "b".repeat(64);
    repeated.work.lease_expires_at = "2026-09-27T18:55:00.123456789Z";
    repeated.claimContext.claimed_at = "2026-09-27T18:50:00.123456789Z";
    Object.assign(repeated.claimContext.current_issue, { lease_token: repeated.work.lease_token, stage_token: repeated.work.stage_token,
      claimed_at: repeated.claimContext.claimed_at, lease_expires_at: repeated.work.lease_expires_at });
    positive("second interruption retains same receipt/counters", () => validateStaticRecoveryClaim(repeated.work, contract, repeated.claimContext));
    assert.deepEqual(repeated.work.static_recovery, work.static_recovery);
    assert.equal(repeated.work.attempt_count, work.attempt_count);
    assert.equal(repeated.work.retry_generation, work.retry_generation);
    const renewal = { request: { lease_token: work.lease_token, requested_lease_seconds: 900, correlation_id: "static-renewal-01" },
      response: { work_id: work.work_id, lease_expires_at: "2026-09-27T19:00:00.123456789Z", total_lease_seconds: 1200, correlation_id: "static-renewal-01" } };
    const renewalContext = { work, state: work.static_recovery.state, claimed_at: trace.claimed_at,
      request_received_at: trace.received_at, current_total_lease_seconds: 300, destination_mode: "static" };
    positive("pending static lease renewal", () => validateRenewal(renewal, contract, renewalContext));
    negative("dynamic pending renewal", "lease_conflict", () => validateRenewal(renewal, contract, { ...renewalContext, destination_mode: "dynamic" }));
    negative("pending renewal missing receiver mode", "lease_conflict", () => { const c = copy(renewalContext); delete c.destination_mode; validateRenewal(renewal, contract, c); });
    negative("expired pending renewal", "work_expired", () => validateRenewal(renewal, contract, { ...renewalContext, request_received_at: "2026-09-27T18:46:00Z" }));
    negative("pending renewal at exact expiry", "work_expired", () => validateRenewal(renewal, contract, { ...renewalContext, request_received_at: work.lease_expires_at }));
    negative("inactive pending renewal", "lease_conflict", () => validateRenewal(renewal, contract, { ...renewalContext, state: "retry_wait" }));
    negative("old-owner pending renewal", "lease_conflict", () => { const r = copy(renewal); r.request.lease_token = model.previous.lease_token; validateRenewal(r, contract, renewalContext); });
    const longWork = { ...copy(work), lease_expires_at: "2026-09-27T22:35:00.123456789Z" };
    const capContext = { ...renewalContext, work: longWork, current_total_lease_seconds: 14100 };
    negative("pending lease beyond four-hour total", "lease_limit_exceeded", () => validateRenewal(renewal, contract, capContext));
    const capRenewal = copy(renewal);
    capRenewal.request.requested_lease_seconds = 300;
    capRenewal.response.total_lease_seconds = 14400;
    capRenewal.response.lease_expires_at = "2026-09-27T22:40:00.123456789Z";
    positive("pending lease at exact four-hour total", () => validateRenewal(capRenewal, contract, capContext));
  }
  assert.deepEqual(contract.publication_work.retry_backoff_seconds, [60, 300, 900]);
  assert.equal(contract.publication_work.maximum_total_attempts, 4);
  const validatorSource = await readFile(new URL("protocol-validation.mjs", import.meta.url), "utf8");
  const parse5Url = new URL("../node_modules/parse5/dist/index.js", import.meta.url).href;
  let reversions = 0;
  const reversion = async (label, search, replacement, exercise) => {
    assert.equal(validatorSource.split(search).length, 2, `${label}: exact unique guard`);
    const mutant = await import(`data:text/javascript;base64,${Buffer.from(validatorSource.replace('from "parse5";', `from "${parse5Url}";`).replace(search, replacement)).toString("base64")}#static-recovery-${label}`);
    // The real validator's rejection is exercised above. This must demonstrate
    // that removing the named guard actually changes that rejection to admission.
    exercise(mutant);
    reversions++;
  };
  const m = models[0];
  await reversion("retained-receipt", '  if (canonicalize(work.static_recovery.acknowledgement) !== canonicalize(context.accepted_receipt.acknowledgement)\n      || canonicalize(work.static_recovery.response) !== canonicalize(context.accepted_receipt.response)) fail("integrity_failed", "recovery does not match the actual retained receipt");', "", mutant => {
    const changed = copy(m); changed.work.static_recovery.acknowledgement.destination_binding.external_id = "invented:object";
    assert.doesNotThrow(() => mutant.validateStaticRecoveryClaim(changed.work, contract, changed.claimContext));
  });
  await reversion("receipt-association", 'issue.receipt_id !== context.accepted_receipt.receipt_id', "false", mutant => {
    const changed = copy(m); changed.claimContext.current_issue.receipt_id = "another-receipt";
    assert.doesNotThrow(() => mutant.validateStaticRecoveryClaim(changed.work, contract, changed.claimContext));
  });
  await reversion("live-owner", '  if (previous.active && compareTimestamps(context.claimed_at, previous.lease_expires_at, "claimed_at", "previous lease_expires_at") <= 0) fail("lease_conflict", "a live owner cannot be displaced");', "", mutant => {
    const changed = copy(m); changed.claimContext.previous_issue.lease_expires_at = "2026-09-27T18:50:00Z";
    assert.doesNotThrow(() => mutant.validateStaticRecoveryClaim(changed.work, contract, changed.claimContext));
  });
  await reversion("expired-recovery-ACK", '  if (compareTimestamps(context.received_at, work.lease_expires_at, "received_at", "lease_expires_at") >= 0) fail("work_expired");', "", mutant => {
    const changed = copy(m); changed.context.received_at = "2026-09-27T18:46:00Z";
    assert.doesNotThrow(() => mutant.validateStaticRecoveryTransition(changed.work, changed.next, contract, changed.work.static_recovery.state, changed.context));
  });
  await reversion("current-visibility", '  for (const field of permissionFields) if (authority[field] !== true) fail("reconciliation_required", "current scope/visibility/policy denies recovery");', "", mutant => {
    const changed = copy(m); changed.claimContext.authority.visible = false;
    assert.doesNotThrow(() => mutant.validateStaticRecoveryClaim(changed.work, contract, changed.claimContext));
  });
  console.log(`Static recovery conformance: ${positives} positive, ${negatives} exact-error negative controls and ${reversions} detecting source reversions; receiver persistence/atomicity/restart remains downstream qualification.`);
  return { positives, negatives, reversions };
}
