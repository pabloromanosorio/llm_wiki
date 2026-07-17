# Milestone 6 Execution DAG

```yaml
objective: add a lazy dual-MCP OpenDeepWiki route for deep repository analysis while Nashsu remains the sole canonical knowledge core
root_owner: current Codex root session

nodes:
  - id: intake
    kind: root
    depends_on: []
    outcome: reconcile the M6 handoff with the current repository, OpenDeepWiki interface, and local runtime constraints
    status: completed

  - id: interface-scout
    kind: root
    archetype: scout
    depends_on: [intake]
    outcome: verify the official OpenDeepWiki MCP endpoints, tool surfaces, runtime requirements, and pinned upstream revision
    write_scope: read-only
    status: completed

  - id: policy-proof
    kind: root
    archetype: verifier
    depends_on: [interface-scout]
    outcome: add a focused failing test for lazy configuration, authority boundaries, and pinned-source discipline
    write_scope: focused test only
    status: completed

  - id: phase-one-integration
    kind: root
    archetype: builder
    depends_on: [policy-proof]
    outcome: add the disabled-by-default OpenDeepWiki MCP entry and repository-analysis routing instructions
    write_scope: .codex/config.toml, AGENTS.md, and MCP documentation
    status: completed

  - id: review
    kind: root
    archetype: reviewer
    depends_on: [phase-one-integration]
    outcome: independently review laziness, authority, cost, credential, and source-verification boundaries
    write_scope: read-only
    status: completed

  - id: verify
    kind: root
    archetype: verifier
    depends_on: [phase-one-integration]
    outcome: pass focused policy tests, installed Codex parsing, and proportional repository tests
    write_scope: read-only except generated test artifacts
    status: completed

  - id: integrate
    kind: root
    depends_on: [review, verify]
    outcome: resolve findings, record the external runtime gate, commit, push, and report
    status: completed
```

Delegation note: the current runtime exposes no native subagent/spawn tool. The
root performs the bounded scout, builder, reviewer, and verifier passes
sequentially; architecture and integration remain root-owned.

## Reconciled implementation boundary

Milestone 6 implements Phase 1 only. OpenDeepWiki remains an independently run,
optional service. The checked-in Codex server entry is disabled by default so
ordinary work neither starts repository processing nor pays a startup penalty.
No native `RepositoryKnowledgeProvider`, compiler, queue, graph, credential
store, generated-document mirror, or production dependency is added.

The current official OpenDeepWiki `main` interface was inspected at commit
`2940a6eb5e90447d57273883330c48b05ab8dfdd` (2026-07-15). It exposes global MCP
at `/api/mcp` and repository-scoped MCP at `/api/mcp/{owner}/{repo}`. The global
tools list/search repositories and search/read generated docs; repository scope
adds documentation search, repository structure, and source-file reads.

## External runtime gate

The local machine currently has no Docker command, no configured
`OPENROUTER_API_KEY`, and about 13 GiB free. Running the full OpenDeepWiki stack
and acceptance tests R2/R4-R6 therefore requires an explicit later setup choice.
This milestone must not silently install that external stack or consume model
credits. Static/lazy configuration, Nashsu repository-record behavior, and
failure isolation remain locally verifiable.

## Acceptance evidence

- R1: the Research template creates lightweight repository records with
  `analysis_status: unregistered`; the focused policy test confirms registration
  does not imply processing. OpenDeepWiki was absent on port 8080 throughout.
- R2: live processing and generated-document search are externally gated by the
  missing optional runtime and model credential; no substitute compiler was
  installed or mocked as acceptance evidence.
- R3: the integration adds no OpenDeepWiki data path, write tool, graph import,
  or document mirror. Nashsu remains the only canonical store.
- R4-R6: `AGENTS.md` requires pinned commit/path/symbol evidence, makes actual
  code authoritative over generated docs, and treats changed commits as stale.
  Live end-to-end disagreement and repository-advance cases remain part of the
  external runtime gate.
- R7: with OpenDeepWiki unavailable, Nashsu health stayed `ok`, MCP stayed
  enabled, LAN access stayed disabled, and the no-model MCP smoke test listed 10
  tools, pinned `Workbenchis`, and read its empty wiki successfully.

Verification completed without LLM calls: 1,755 frontend mock tests, production
build, 20 MCP tests, and 344 Rust tests passed with 1 ignored. Installed Codex
0.142.5 parsed the default-disabled OpenDeepWiki server and the explicit
per-session enable override. The sequential correctness, testing,
maintainability, standards, agent-parity, and prior-learning review found no
actionable issue; no `docs/solutions/` learning corpus exists in this checkout.
