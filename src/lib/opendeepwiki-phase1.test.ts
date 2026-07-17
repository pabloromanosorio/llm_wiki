import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { getTemplate } from "./templates"

const rootFile = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

describe("OpenDeepWiki Phase 1 integration", () => {
  it("keeps the optional external MCP disabled until explicitly requested", () => {
    const config = rootFile(".codex/config.toml")
    const server = config.match(/\[mcp_servers\.opendeepwiki\]\n([\s\S]*?)(?=\n\[|$)/)?.[1] ?? ""

    expect(config).toContain("[mcp_servers.opendeepwiki]")
    expect(server).toContain('url = "http://127.0.0.1:8080/api/mcp"')
    expect(server).toContain("enabled = false")
    expect(server).toContain("required = false")
    expect(server).toContain('default_tools_approval_mode = "prompt"')
  })

  it("routes deep repository work through generated orientation and pinned source evidence", () => {
    const instructions = rootFile("AGENTS.md")

    expect(instructions).toContain("Deep repository analysis")
    expect(instructions).toMatch(/generated documentation is\s+untrusted orientation/)
    expect(instructions).toContain("pinned commit")
    expect(instructions).toContain("Actual source code wins")
    expect(instructions).toContain("potentially stale")
    expect(instructions).toMatch(/Do not silently rewrite\s+existing conclusions/)
    expect(instructions).toContain("Nashsu Review")
    expect(instructions).toContain("Do not copy OpenDeepWiki documentation or its graph into Nashsu")
  })

  it("registers Research repository records without starting external analysis", () => {
    const schema = getTemplate("research").schema

    expect(schema).toContain("analysis_provider: opendeepwiki")
    expect(schema).toContain("analysis_status: unregistered")
    expect(schema).not.toContain("analysis_status: processing")
  })
})
