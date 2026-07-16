# Milestone 2 Execution DAG

```yaml
objective: register and screen Research source candidates before selectively sending included items to the existing ingest queue
root_owner: current Codex root session

test_seams:
  - source intake routing: Research registers; non-Research preserves immediate ingest
  - candidate persistence: project-scoped atomic JSON with tolerant migration
  - screening: bounded local extraction plus validated structured output
  - decisions: include, watch, exclude, and editable classifications
  - queue handoff: one batch call to the existing ingest queue for included items only

nodes:
  - id: root-scope
    kind: root
    depends_on: []
    outcome: reconcile the handoff with source lifecycle, project state, activity/review patterns, and queue seams
    status: completed

  - id: persistence-red-green
    kind: root
    archetype: builder
    depends_on: [root-scope]
    outcome: add the small project-scoped candidate store, normalization, stable deduplication, and migration tests
    write_scope: candidate model and persistence files plus their tests
    status: completed

  - id: intake-red-green
    kind: root
    archetype: builder
    depends_on: [persistence-red-green]
    outcome: route Research file, folder, URL, scheduled, and watched imports to registration while preserving non-Research behavior
    write_scope: source intake integration files and tests
    status: completed

  - id: screening-red-green
    kind: root
    archetype: builder
    depends_on: [persistence-red-green]
    outcome: add cheap resumable local metadata extraction and bounded structured screening through the configured ingest model
    write_scope: screening module and tests
    status: completed

  - id: decision-ui
    kind: root
    archetype: builder
    depends_on: [intake-red-green, screening-red-green]
    outcome: add the Research-only candidate table, selection, decisions, classification editing, screening, and queue action
    write_scope: Sources UI and translations
    status: completed

  - id: queue-handoff
    kind: root
    archetype: builder
    depends_on: [intake-red-green, screening-red-green]
    outcome: enqueue included candidates through the existing ingest queue and persist queue task identity
    write_scope: candidate queue adapter and tests
    status: completed

  - id: persistence-review
    kind: root
    archetype: reviewer
    depends_on: [decision-ui, queue-handoff]
    outcome: independently review atomicity, malformed/legacy migration, duplicate stability, restart behavior, and project isolation
    write_scope: read-only
    status: completed

  - id: acceptance-verification
    kind: root
    archetype: verifier
    depends_on: [persistence-review]
    outcome: run S1-S5 plus relevant queue/restart and full repository verification
    write_scope: read-only except generated test/build artifacts
    status: completed

  - id: root-integration
    kind: root
    depends_on: [acceptance-verification]
    outcome: reconcile findings, accept the final diff, and commit the milestone
    status: completed
```

Delegation note: this task runtime exposes no subagent/spawn tool. To prevent
overlapping writes, the root is executing builder slices sequentially and will
perform persistence review and verification as separate read-only passes.
Architecture, integration, and milestone acceptance remain root-owned.

## Acceptance evidence

- S1: 50 Research candidates register without preprocessing or queue creation.
- S2: mixed include/watch/exclude decisions enqueue only included candidates.
- S3: fingerprint and normalized URL identity deduplicate without a second ingest.
- S4: bounded local extraction produces a resumable watch assessment without an
  external metadata service or configured model.
- S5: General and other non-Research projects preserve immediate ingest behavior.
- Persistence review: atomic writes, serialized project updates, legacy-array
  normalization, move/delete handling, and fail-closed malformed JSON behavior.
- Verification: 68 focused tests, 1,745 mock tests, production build, 20 MCP
  tests, and 341 passing Rust tests with 1 ignored. The separate real-LLM suite
  retains six pre-existing provider/embedding failures unrelated to this diff.
