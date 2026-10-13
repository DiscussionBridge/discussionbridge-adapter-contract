# DiscussionBridge Adapter Protocol 0.2.0-alpha.23

This is the historical locally frozen specification for preserved v1 and
the proposed v2 CMS and same-plugin Discourse network contract. Its approval
claims record the predecessor task; Phil has warned that inherited records
contain errors and do not authorize current work. It is not an implemented or
runtime-qualified product. The annotated local tag
`v0.2.0-alpha.23` identifies the immutable release commit; no GitHub push is
authorized by this freeze.

## Release identity and approval

[release.json](release.json) is the release identity and portable binding index.
The predecessor manifest records approval of the exact seven-file packet on
October 10, 2026 (EP01), version selection and local commit/tag freeze (EF01).
Those are retained provenance claims, not fresh authorization. It records a
read-only GitHub tag inventory of Alpha.19 through Alpha.22 before selecting
Alpha.23. Existing frozen identities are preserved during current cleanup.

## Contract files

The immutable tag retains the specification indexed below. The predecessor
working tree also contains the separate
[URL transmission amendment](amendments/url-transport-20261010/README.md).
That working amendment requires encoded v2 URLs, preserves readable
presentation and native identities, and reports oversized URLs clearly.
It is not part of the existing tag or release manifest and has not been
assigned a new immutable release identity.

On October 12, 2026, Phil directed cleanup and completion of the existing core
work list. Network will be a separate optional add-on requiring DiscussionBridge;
Federation will be an independent plugin. Network/Workspace setup and protocol
scaffolding have been removed from the current deployable core source. The
untracked Workspace amendment is preserved outside this component in the
product workspace's `_trash/cleanup-20261012/adapter-contract` quarantine, with
SHA-256 records. The frozen packet and tag remain unchanged historical records.
No Network/Workspace API implementation is established by this release index.

| Role | Local member |
| --- | --- |
| Preserved v1 contract | [contract.json](contract.json) |
| Preserved v1 examples | [fixtures](fixtures/) |
| Approved successor overview | [Overview](approved-packet/ADAPTER_PROTOCOL_SUCCESSOR_PROPOSAL_20261009.md) |
| v2 semantic rules | [Wire specification](approved-packet/ADAPTER_PROTOCOL_V2_WIRE_SPECIFICATION_20261009.md) |
| v2 types and routes | [Typed contract](approved-packet/ADAPTER_PROTOCOL_V2_WIRE_PROPOSAL_20261009.json) |
| Positive examples | [Examples](approved-packet/ADAPTER_PROTOCOL_V2_EXAMPLES_20261009.json) |
| Negative cases and runtime plan | [Conformance cases](approved-packet/ADAPTER_PROTOCOL_V2_CONFORMANCE_CASES_20261009.json) |
| Same shared-plugin Hub architecture | [Hub architecture](approved-packet/DISCOURSE_HUB_ARCHITECTURE_PROPOSAL_20261009.md) |
| Requirements and qualification linkage | [Change matrix](approved-packet/ADAPTER_PROTOCOL_SUCCESSOR_CHANGE_MATRIX_20261010.md) |

The typed artifact and companion semantic rules jointly define v2. The
`DB-PROPOSED-TYPES-1` grammar is descriptive, not JSON Schema or an executable
validator. A disagreement requires resolution rather than an implementer's
silent choice. The matrix and planned cases do not establish runtime proof.

## Preserved bytes and portable references

All seven files under `approved-packet/` retain their exact EP01-approved bytes
and SHA-256 identities. Their historical proposal labels, pending-approval
wording, null release version and workstation links are retained as approval
records, not current release status. The release manifest establishes the
current identity and maps portable paths without changing wire semantics.

Use the index above and `portable_bindings` in the manifest. In particular,
the candidate's authoring-workspace v1 references resolve for this release to
the root `contract.json` and `fixtures/`, not to another checkout.

The root README, v1 contract and six v1 fixtures keep the exact Alpha.20 Git
blobs from `27197b7472cb2486993c8b01b4a4282d8697f478`. The root contract's
embedded `0.2.0-alpha.20` version is deliberately preserved; Alpha.23 identifies
this combined specification release, not a change to v1 behavior.

## Next gate

Component implementation requires separate authority and approved native
migration, packaging and qualification work. All 80 planned runtime/native
cases and the two raw malformed-JSON cases remain NOT_RUN. No code-review or
review-method-audit disposition is claimed. Invented Operator Service controls
and historical/trash implementations are excluded.

GitHub changes, sandbox installation/testing and non-sandbox deployment remain
separately gated. The local tag must never be moved or reused; a changed
specification requires a newly authorized immutable identity.
