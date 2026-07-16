import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  readFileExcerpt: vi.fn(),
  streamChat: vi.fn(),
  getTaskLlmConfig: vi.fn(),
  hasUsableLlm: vi.fn(),
  loadResearchCandidates: vi.fn(),
  updateResearchCandidates: vi.fn(),
  addReviewItem: vi.fn(),
}))

vi.mock("@/commands/fs", () => ({
  readFile: mocks.readFile,
  readFileExcerpt: mocks.readFileExcerpt,
}))
vi.mock("@/lib/llm-client", () => ({ streamChat: mocks.streamChat }))
vi.mock("@/lib/llm-task-routing", () => ({ getTaskLlmConfig: mocks.getTaskLlmConfig }))
vi.mock("@/lib/has-usable-llm", () => ({ hasUsableLlm: mocks.hasUsableLlm }))
vi.mock("@/lib/research-candidate-store", () => ({
  loadResearchCandidates: mocks.loadResearchCandidates,
  updateResearchCandidates: mocks.updateResearchCandidates,
}))
vi.mock("@/stores/review-store", () => ({
  useReviewStore: {
    getState: () => ({ addItem: mocks.addReviewItem }),
  },
}))

import {
  researchPurposeReadiness,
  screenResearchCandidates,
} from "./research-screening"
import type { ResearchCandidate } from "./research-candidates"

function candidate(): ResearchCandidate {
  return {
    id: "candidate-1",
    source: {
      kind: "file",
      value: "raw/sources/paper-2026.pdf",
      path: "raw/sources/paper-2026.pdf",
      fingerprint: "abc",
    },
    metadata: { title: "", authors: [], year: "", abstract: "", repositoryUrl: "" },
    assessment: {
      status: "registered",
      relevance: "unknown",
      abstractionLevel: "unknown",
      contributionType: [],
      rationale: "",
      confidence: "low",
    },
    queueTaskId: null,
    createdAt: 1,
    updatedAt: 1,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  let items = [candidate()]
  mocks.loadResearchCandidates.mockImplementation(async () => items)
  mocks.updateResearchCandidates.mockImplementation(async (_path, updater) => {
    items = await updater(items)
    return items
  })
  mocks.readFile.mockImplementation(async (path: string) =>
    path.endsWith("/purpose.md")
      ? [
          "## Research Question",
          "How can bounded orchestration improve research synthesis?",
          "## Scope",
          "In scope: local research workflow design.",
        ].join("\n")
      : "")
  mocks.readFileExcerpt.mockResolvedValue(
    "# Efficient Research Workflows\n\nA bounded orchestration method for research synthesis.",
  )
  mocks.getTaskLlmConfig.mockImplementation((_task, cfg) => cfg)
  mocks.hasUsableLlm.mockReturnValue(true)
  mocks.streamChat.mockImplementation(async (_config, messages, callbacks, _signal, overrides) => {
    expect(messages[0].content).toContain("candidate screening")
    expect(messages[0].content).not.toContain("Generate wiki")
    expect(overrides).toMatchObject({
      reasoning: { mode: "off" },
      max_tokens: 1200,
    })
    callbacks.onToken(JSON.stringify({
      status: "include",
      relevance: "core",
      abstractionLevel: "workflow",
      contributionType: ["method"],
      repositoryUrl: "",
      rationale: "Directly supports the project workflow.",
      confidence: "high",
    }))
    callbacks.onDone()
  })
})

describe("Research candidate screening", () => {
  it("requests minimum purpose fields through Review before a large screening run", async () => {
    mocks.readFile.mockImplementation(async (path: string) =>
      path.endsWith("/purpose.md")
        ? "## Research Question\n>\n## Scope\n**In scope:**\n-"
        : "# Paper")

    const screened = await screenResearchCandidates(
      { id: "p1", name: "Research", path: "/project" },
      ["candidate-1"],
      { provider: "openai", apiKey: "key", model: "model" } as never,
    )

    expect(screened[0].assessment.status).toBe("registered")
    expect(mocks.streamChat).not.toHaveBeenCalled()
    expect(mocks.addReviewItem).toHaveBeenCalledWith(expect.objectContaining({
      title: "Complete Research purpose before screening",
      sourcePath: "purpose.md",
    }))
  })

  it("identifies the minimum Research purpose fields", () => {
    expect(researchPurposeReadiness(
      "## Research Question\nWhat evidence supports X?\n## Scope\nIn scope: peer-reviewed studies.",
    )).toEqual({ ready: true, missing: [] })
    expect(researchPurposeReadiness(
      "## Research Question\n>\n## Scope\n**In scope:**\n-",
    )).toEqual({ ready: false, missing: ["Research Question", "Scope"] })
  })

  it("uses a bounded structured ingest-model call without running wiki generation", async () => {
    const screened = await screenResearchCandidates(
      { id: "p1", name: "Research", path: "/project" },
      ["candidate-1"],
      { provider: "openai", apiKey: "key", model: "model" } as never,
    )

    expect(screened[0]).toMatchObject({
      metadata: {
        title: "Efficient Research Workflows",
        year: "2026",
      },
      assessment: {
        status: "include",
        relevance: "core",
        abstractionLevel: "workflow",
        contributionType: ["method"],
        confidence: "high",
      },
    })
    expect(mocks.readFileExcerpt).toHaveBeenCalledWith(
      "/project/raw/sources/paper-2026.pdf",
      { maxChars: 14000, maxPdfPages: 2 },
    )
  })

  it("still produces a resumable local classification when no model is configured", async () => {
    mocks.hasUsableLlm.mockReturnValue(false)

    const screened = await screenResearchCandidates(
      { id: "p1", name: "Research", path: "/project" },
      ["candidate-1"],
      { provider: "openai", apiKey: "", model: "" } as never,
    )

    expect(mocks.streamChat).not.toHaveBeenCalled()
    expect(screened[0]).toMatchObject({
      metadata: { title: "Efficient Research Workflows" },
      assessment: {
        status: "watch",
        relevance: "unknown",
        rationale: expect.stringContaining("Local metadata"),
        confidence: "low",
      },
    })
  })
})
