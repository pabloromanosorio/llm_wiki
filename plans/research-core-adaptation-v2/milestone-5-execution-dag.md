# Milestone 5 Execution DAG

```yaml
objective: make Codex a disciplined, project-scoped Nashsu MCP client without adding a second runtime or autonomous knowledge writes
root_owner: current Codex root session

test_seams:
  - native chat routing: API and MCP chat use the selected chat-task profile unless a project override is active
  - Codex configuration: the checked-in project MCP config passes the installed Codex strict parser
  - MCP connection: the built server lists and invokes Nashsu tools through the existing local API client
  - instruction policy: relevant tasks load Nashsu progressively; mechanical tasks make no Nashsu call; durable writes require user approval

nodes:
  - id: root-reconciliation
    kind: root
    depends_on: []
    outcome: reconcile the handoff with current Codex configuration, API routing, MCP tools, and project binding
    status: completed

  - id: routing-red-green
    kind: root
    archetype: builder
    depends_on: [root-reconciliation]
    outcome: persist a non-secret chat-task profile and make native API chat resolve it with current provider credentials
    write_scope: task routing persistence, settings integration, Rust API resolver, and focused tests
    status: completed

  - id: codex-integration
    kind: root
    archetype: builder
    depends_on: [root-reconciliation]
    outcome: add a portable project-scoped MCP config and concise root AGENTS guidance based on the handoff
    write_scope: .codex/config.toml, AGENTS.md, and MCP documentation
    status: completed

  - id: focused-verification
    kind: root
    archetype: verifier
    depends_on: [routing-red-green, codex-integration]
    outcome: pass focused TypeScript and Rust tests, Codex strict config parsing, MCP tests, and a no-model connection check
    write_scope: read-only except generated build artifacts
    status: completed-with-external-gate

  - id: independent-review
    kind: root
    archetype: reviewer
    depends_on: [focused-verification]
    outcome: independently review scope, compatibility, credential handling, project pinning, no-load behavior, and write discipline
    write_scope: read-only
    status: completed

  - id: root-integration
    kind: root
    depends_on: [independent-review]
    outcome: resolve findings, run the full verification matrix, and accept or reject Milestone 5
    status: completed

  - id: commit
    kind: root
    depends_on: [root-integration]
    outcome: commit the accepted Milestone 5 change without opening a stacked upstream PR before its dependency merges
    status: completed
```

Delegation note: this task runtime exposes no native spawn/subagent tool. The
root therefore performs bounded builder, verifier, and independent reviewer
passes sequentially. No worker writes overlap, and architecture, integration,
and user communication remain root-owned.

## Scope reconciliation

The handoff's Milestone 5 is primarily a read-oriented Codex integration, not a
new Research write API. The existing MCP server already exposes status, project
selection, files, read, reviews, search, chat, graph, and explicit rescan tools.
This milestone therefore adds no candidate or corpus-bootstrap MCP write tools.
It closes the demonstrated native chat-routing gap and adds the project-scoped
Codex policy/configuration required by acceptance tests C1-C6.

## Acceptance evidence

- C1: the installed Codex 0.142.5 strict parser accepted `.codex/config.toml`
  when the exact repository path was trusted. A live no-model MCP smoke test
  started the built server, listed all 10 tools, and invoked status, project
  listing, and project selection against the running desktop API. The desktop
  app reported MCP enabled, LAN access disabled, and the `Workbenchis` Research
  project pinned.
- C2-C6: `AGENTS.md` encodes explicit project pinning, relevant triggers,
  no-load behavior, focused-before-deep retrieval, temporary-focus isolation,
  and user-gated durable writes. A bounded Codex OAuth check discovered the MCP
  server and attempted status and project-selection tools; noninteractive tool
  execution was initially canceled by `prompt` approval mode. The final config
  auto-approves the narrow allowlist while retaining an explicit prompt for chat,
  which can spend provider credits. No further model call was made.
- Native routing: a non-secret chat profile lets API/MCP chat honor supported
  HTTP task models with current provider settings. Malformed profile secrets
  are ignored, and frontend-only Codex/Claude CLI profiles safely preserve the
  usable global backend model.
- Verification: 1,752 mock tests, production build, 20 MCP tests, and 344 Rust
  tests passed with 1 ignored. The app launched and reported the local API at
  `127.0.0.1:19828` before being stopped cleanly.
- Independent review: no remaining hard standards or specification findings.
  A CLI-transport compatibility finding was fixed before final verification;
  no production dependency or additional runtime was added.

## Reconciled contradictions and deviations

- The handoff and current online manual allow MCP approval mode `writes`, but
  installed Codex 0.142.5 rejects it. The compatible policy is `approve` for
  the narrow local allowlist, with `prompt` retained specifically for chat.
- Codex 0.142.5 requires trust for the exact Git root; trust on its parent
  Workbench directory did not activate project-local configuration.
- The handoff template uses an absolute MCP script path. This repository uses a
  portable project-relative command and documents launching Codex at the Git
  root. Codex 0.142.5 interprets a relative MCP `cwd` from the launch directory,
  not from `.codex/`, so the initially proposed `cwd = ".."` was removed after
  an actual Codex handshake exposed the mismatch.
- Desktop chat can use Codex CLI through ChatGPT OAuth, but the Rust API Agent
  currently supports only HTTP/Ollama providers. Native task routing therefore
  falls back to the usable global backend model for CLI-only profiles rather
  than adding a second subprocess implementation in this milestone.
