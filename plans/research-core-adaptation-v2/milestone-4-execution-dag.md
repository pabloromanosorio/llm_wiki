# Milestone 4 Execution DAG

```yaml
objective: build or refresh a bounded corpus-level Research landscape from compiled Nashsu pages without requiring embeddings
root_owner: current Codex root session

test_seams:
  - inventory: deterministic compiled-page inventory from the Research project
  - grouping: tags, sources, wikilinks, methodology relationships, and graph communities without embeddings
  - bounded synthesis: inventory -> group -> cluster synthesis -> global synthesis with hierarchical reduction for oversized corpora
  - writes: exact or existing equivalent aggregate pages updated through safe merge, backup, and Review behavior
  - action: Research-only Build / refresh research landscape entry point

nodes:
  - id: root-scope
    kind: root
    depends_on: []
    outcome: reconcile the corpus-bootstrap contract with current graph, model routing, merge, review, and Sources UI seams
    status: completed

  - id: inventory-grouping-red-green
    kind: root
    archetype: builder
    depends_on: [root-scope]
    outcome: inventory compiled pages deterministically and assign every page to a bounded group without embeddings
    write_scope: corpus bootstrap module and focused tests
    status: completed

  - id: synthesis-red-green
    kind: root
    archetype: builder
    depends_on: [inventory-grouping-red-green]
    outcome: produce cluster syntheses and recursively reduce them before global synthesis when context requires it
    write_scope: corpus bootstrap synthesis logic and focused tests
    status: completed

  - id: merge-review-writes
    kind: root
    archetype: builder
    depends_on: [synthesis-red-green]
    outcome: safely update the named overview, synthesis, and query pages without duplicate aggregate pages
    write_scope: corpus bootstrap write integration and focused tests
    status: completed

  - id: research-action
    kind: root
    archetype: builder
    depends_on: [merge-review-writes]
    outcome: expose a Research-only Build / refresh research landscape action using the configured chat model
    write_scope: Research Sources UI and translations
    status: completed

  - id: inventory-synthesis-audit
    kind: root
    archetype: reviewer
    depends_on: [research-action]
    outcome: independently audit complete inventory coverage, grouping evidence, bounded passes, page resolution, and no hidden embedding/compiler dependency
    write_scope: read-only
    status: completed

  - id: acceptance-verification
    kind: root
    archetype: verifier
    depends_on: [inventory-synthesis-audit]
    outcome: run handoff M1-M5 plus full repository verification
    write_scope: read-only except generated test/build artifacts
    status: completed

  - id: root-integration
    kind: root
    depends_on: [acceptance-verification]
    outcome: resolve findings, record evidence, accept the final diff, and commit
    status: completed
```

Delegation note: this task runtime exposes no subagent/spawn tool. The root will
perform the inventory/synthesis audit and final verification as separate
read-only passes after sequential builder work. The corpus map, all writes,
integration decisions, and final acceptance remain root-owned.

Audit reconciliation:

- removed silent per-page clipping so the inventory contains every compiled page
  body in full, with oversized pages split into lossless bounded segments before
  cluster synthesis;
- constrained evidence checks to actual inventory page slugs and created Review
  work when fallback links are attached;
- routed existing aggregate pages through the ordinary safe body merge so curated
  text survives;
- resolved equivalent aggregate pages by canonical path, known title, or known
  slug;
- treated compiled page instructions as untrusted data in every synthesis and
  merge prompt;
- created a deterministic Review item from cluster contradictions even if the
  global model omits one.

Acceptance evidence:

- M1 embeddings disabled: corpus bootstrap has no embedding or retrieval-store
  dependency; focused tests complete with only compiled-page and graph mocks.
- M2 coherent orientation: the global synthesis contract requires problem and
  method families, findings, differences, constraints, negative findings,
  contradictions, open questions, and relevance to purpose.
- M3 evidence links: substantive sections validate wikilinks against actual
  inventory slugs; missing or hallucinated evidence receives bounded fallback
  links plus a Review item.
- M4 no duplicate aggregate pages: the write test runs the action twice and
  reuses existing equivalent paths by canonical path, title, or slug.
- M5 bounded context: the synthesis test forces cluster reduction before the
  global pass, verifies raw pages do not enter the global prompt, and verifies
  compiled page bodies are not silently clipped.
- Full verification: `npm run test:mocks` (127 files, 1751 tests),
  `npm run build`, `npm run mcp:test` (20 tests), and `cargo test -q`
  (341 passed, 1 ignored).
