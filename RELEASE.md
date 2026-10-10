# DiscussionBridge Adapter Protocol 0.2.0-alpha.23

This is the locally frozen, Phil-approved specification for preserved v1 and
the new v2 CMS and same-plugin Discourse network contract. It is not an
implemented or runtime-qualified product. The annotated local tag
`v0.2.0-alpha.23` identifies the immutable release commit; no GitHub push is
authorized by this freeze.

## Release identity and approval

[release.json](release.json) is the release identity and portable binding index.
Phil approved the exact seven-file packet on October 10, 2026 (EP01), then
delegated version selection and authorized the local commit/tag freeze (EF01).
The version was selected after a read-only GitHub tag inventory found Alpha.19
through Alpha.22 and no Alpha.23. No old tag or discarded implementation is used.

## Contract files

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
