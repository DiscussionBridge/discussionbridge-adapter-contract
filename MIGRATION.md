# Coordinated Alpha.20 to Alpha.22 Transition

Alpha.22 is a coordinated contract transition for the DiscussionBridge-
controlled estate. It is not a rolling compatibility release. There is no
runtime alias or compatibility behavior for superseded presentation names,
headers, fields, routes, or state.

## Preconditions

1. Preserve protected backups of every Discourse database/configuration,
   adapter state store, native platform database/content store, and static
   deployment/rollback artifact.
2. Inventory exact Alpha.20 Bridge Records, connections, directions, lanes,
   mappings, presentation settings, native destination identities, and URLs.
3. Stop adapter timers/workers and prevent new Alpha.20 mutations.
4. Verify no active native write, static build, deployment, URL move, retry, or
   reconciliation action remains in flight.
5. Replace every controlled configuration value with only `simple`, `full`, or
   `interactive`. Any other value blocks deployment; it is not normalized.
6. Configure and validate `DISCUSSIONBRIDGE_FORUM_NAME` wherever Alpha.22
   requires it.
7. Prepare one exact shared-plugin artifact/version for all forums and one
   exact adapter artifact/version for every installation of each platform.
   Adapter Protocol Alpha.22 is the wire-contract version; it does not assign
   the component package versions.
8. Freeze a cutover manifest that binds the Alpha.22 contract artifact hash,
   shared-plugin artifact/version/hash, every adapter artifact/version/hash,
   receiver schema migration identity, configuration revision, connection and
   destination-policy revisions, and consumer deployment identities.

The exact cutover manifest fields are `manifest_id`, `adapter_protocol`,
`shared_plugin`, `adapters`, `receiver_schema`, `configuration_revision`,
`policy_revisions`, `consumer_identities`, and `correlation_id`.
`adapter_protocol` and `shared_plugin` each require `version` and `sha256`;
each adapter entry requires `profile`, `version`, and `sha256`. Every digest is
the SHA-256 of the immutable artifact bytes. Preflight compares every installed
and prepared identity with this manifest and rejects any mismatch before schema
migration or content mutation.

## Receiver migration requirements

The shared plugin migration begins from the Alpha.30 schema and runs in one
database transaction wherever the database permits it.

- Preserve every Content Connection ID, secret digest, enabled state, origin,
  direction, lane, and existing policy scope.
- Preserve every Bridge resource ID, direction, topic ID/URL, source/destination
  external ID, canonical URL, and existing eligible Discourse Core adoption.
- Do not convert established Bridge Records to `legacy`, `forum_sync_pending`,
  `forum_sync`, or another semantic program merely because Alpha.22 adds
  initial synchronization.
- Derive a From-Discourse baseline `source_revision` and positive
  `source_revision_sequence` from the authoritative current first post and its
  Discourse revision/version. Record source-created and source-updated times
  from authoritative Discourse data.
- Existing destination bindings enter `pending` only for the missing Alpha.22
  acknowledgement fields; they retain their native external ID and canonical
  URL. Before their first acknowledgement, `applied_source_revision`,
  `publication_revision`, and `synchronized_at` are absent rather than null or
  invented. The three fields become required together when synchronization
  succeeds, and a successful exact-revision acknowledgement moves the binding
  to `active`.
- Existing To-Discourse records retain their topic and resource identity. Their
  source platform must deliver one exact Alpha.22 revision against the existing
  external ID and canonical URL to establish source revision/time/content
  metadata without creating a topic.
- Create no publication work until an operator validates the connection,
  catalog where required, mapping policy, and initial synchronization scope.
- Operator Service remains default-off until a signed entitlement is explicitly
  enrolled.
- Discourse network publication remains default-off until exact forum IDs,
  directions, category scope, and routes are authorized.

Any duplicate identity, URL collision, missing authoritative revision,
ambiguous binding, unsupported presentation value, or partial schema failure
aborts the migration and leaves the pre-migration state recoverable.

## Adapter state transition

Each adapter migrates from its known-solid baseline state rather than importing
the later altered candidate as authority.

- Preserve stable native external IDs and existing Bridge resource/topic
  mappings.
- Preserve the last known native canonical URL and reject unverified drift.
- Add source revision sequence, source/source-updated times, policy revision,
  destination publication revision, synchronization, verification, and work
  state without changing existing identity.
- Treat existing content as unverified for Alpha.22 until the exact current
  source revision is reconciled and, where required, publicly verified.
- Do not begin whole-corpus work automatically on package installation or
  activation.
- Do not import installation-, demo-, or rollout-specific output, duplicate
  publication paths, or the dirty Alpha.21 working tree's state as product
  behavior.

## Coordinated cutover

1. Put every Alpha.20 worker/timer in a confirmed stopped state.
2. Apply the exact shared-plugin package named in the cutover manifest to all controlled forums while
   adapter workers remain stopped.
3. Run migrations and verify exact counts, identities, connection scope, and
   zero unrequested publication work.
4. Install each platform adapter package named in the cutover manifest through
   its normal package path and verify protected configuration plus migrated state.
5. Validate `GET /discussion-bridge/v1/connection.json` and the exact
   `X-DiscussionBridge-Contract: 0.2.0-alpha.22` boundary for every connection.
6. Run one-item then ten-item canaries in each direction/profile.
7. Enable bounded workers sequentially, proving interruption/restart and public
   verification before the next profile.
8. Reconcile all mappings and only then retire the maintenance boundary.

Every cutover proof records the exact manifest identity. A different contract,
plugin, adapter, schema, configuration, or consumer identity is a different
candidate and invalidates prior cutover evidence.

## Rollback boundary

Rollback is permitted before Alpha.22 accepts a new authoritative source
revision or destination acknowledgement that cannot be represented safely by
Alpha.20.

Before that boundary, stop Alpha.22 workers, restore the protected plugin and
adapter state/configuration, reinstall exact Alpha.20 artifacts, and verify the
pre-cutover census.

After that boundary, automatic downgrade is prohibited. Preserve Alpha.22
evidence and use an exact forward repair or protected full-state restoration.
Never run Alpha.20 and Alpha.22 workers concurrently against one connection.
