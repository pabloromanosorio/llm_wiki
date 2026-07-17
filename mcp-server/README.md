# LLM Wiki MCP Server

This package exposes the running LLM Wiki desktop app as a Model Context Protocol server.

It does **not** scan project folders directly and does **not** copy the app's search or graph logic. Every tool calls the local desktop API at `http://127.0.0.1:19828/api/v1`, so MCP clients use the same project registry, file permissions, search backend, graph backend, and Source Watch rules as the app.

## Requirements

- Node.js 20+
- LLM Wiki desktop app running
- Settings → API + MCP → "Enable local HTTP API"
- Settings → API + MCP → "Enable MCP access"
- Either:
  - Settings → API + MCP → "Allow access without a token", or
  - `LLM_WIKI_API_TOKEN` set to the configured API token

Optional:

- `LLM_WIKI_API_BASE_URL` to override the default API base URL.

## Build

```bash
cd mcp-server
npm install
npm run build
```

## Run

```bash
LLM_WIKI_API_TOKEN=your-token node dist/src/index.js
```

Example MCP client config:

```json
{
  "mcpServers": {
    "llm-wiki": {
      "command": "node",
      "args": ["/absolute/path/to/llm_wiki/mcp-server/dist/src/index.js"],
      "env": {
        "LLM_WIKI_API_TOKEN": "your-token"
      }
    }
  }
}
```

### Codex project configuration

This repository includes `.codex/config.toml`, which starts the built MCP server
when Codex is launched from the repository root and forwards
`LLM_WIKI_API_TOKEN` from the environment. Build the server before starting
Codex:

```bash
npm run mcp:build
export LLM_WIKI_API_TOKEN=your-token
codex -C /absolute/path/to/llm_wiki
```

The token is optional when the desktop app allows unauthenticated local access.
The checked-in policy auto-approves only the allowlisted local tools. MCP chat
still asks for approval because it may spend provider credits, and source rescan
is excluded because it changes project state.
Codex loads project configuration only for trusted repositories. The checked-in
allow-list excludes `llm_wiki_rescan_sources`; opt into that state-changing tool
only for an explicit rescan task.

### Optional OpenDeepWiki adjunct

The project configuration also declares the separately managed OpenDeepWiki
global MCP endpoint at `http://127.0.0.1:8080/api/mcp`. It is disabled by
default: ordinary Codex work must not start repository processing, wait for an
absent service, or trigger provider spend.

After starting and configuring OpenDeepWiki independently, enable the endpoint
for one repository-analysis session:

```bash
codex -C /absolute/path/to/llm_wiki \
  -c 'mcp_servers.opendeepwiki.enabled=true'
```

For exact source reads, OpenDeepWiki also exposes a repository-scoped endpoint:
`http://127.0.0.1:8080/api/mcp/{owner}/{repo}`. Prefer the actual local checkout
at the repository page's `pinned_commit` for final verification. Generated docs
remain non-canonical, and selected durable findings return through Nashsu's
normal Review flow rather than being bulk-copied.

This contract was checked against AIDotNet/OpenDeepWiki commit
`2940a6eb5e90447d57273883330c48b05ab8dfdd` (2026-07-15). That revision's global
MCP exposes repository listing/routing and generated-document search/read; its
repository-scoped MCP adds documentation search, directory structure, and
source-file reads. OpenDeepWiki installation, credentials, data, and model costs
remain outside this repository.

When API unauthenticated mode is enabled, omit `LLM_WIKI_API_TOKEN`. If MCP access is disabled in Settings, `llm_wiki_status` still works for diagnosis but other tools return an explicit disabled error.

## Tools

- `llm_wiki_status`: health and current project summary.
- `llm_wiki_projects`: known projects and active project.
- `llm_wiki_set_project`: pin the MCP process session to a project. Once pinned, other project tools reject attempts to access a different project.
- `llm_wiki_files`: list project files. `project_id` can be a project UUID, a project filesystem path, or `current`.
- `llm_wiki_read_file`: read an allowed text file such as `wiki/index.md`.
- `llm_wiki_reviews`: list Review tab items. Defaults to unresolved items and supports `status`, `type`, and `limit` filters.
- `llm_wiki_search`: search with the app's shared keyword/vector backend.
- `llm_wiki_chat`: ask the backend Agent chat endpoint and receive answer text, references, usage, and tool events. `mode: deep` broadens backend evidence collection; full Deep Research workflows still live in the desktop app.
- `llm_wiki_graph`: query the app's knowledge graph endpoint.
- `llm_wiki_rescan_sources`: trigger a Source Watch rescan using the user's configured rules.

## Security model

The MCP server inherits the desktop API's security model:

- It only talks to `127.0.0.1` by default.
- It uses the same API token or unauthenticated setting as Settings → API + MCP.
- File reads go through the API path allow-list. Internal app state files are not exposed.
- Review data is exposed only through the dedicated Review endpoint/tool, which defaults to unresolved items rather than opening internal state files directly.
- Search and graph tools operate on projects known to the app; use `project_id: "current"` for the active project.
- For multi-project use, call `llm_wiki_set_project` once. The resolved project ID remains fixed for the lifetime of the MCP subprocess even if the desktop UI switches projects, and every project-tool response includes an `activeProject` marker.

Do not pass API tokens via command-line arguments. Prefer environment variables so they do not appear in shell history.
