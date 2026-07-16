import { describe, expect, it } from "vitest"
import {
  extractLocalCandidateMetadata,
  mergeCandidateDrafts,
  normalizeCandidateStore,
  parseScreeningResponse,
} from "./research-candidates"

describe("Research candidate model", () => {
  it("deduplicates by fingerprint while keeping a stable candidate id", () => {
    const first = mergeCandidateDrafts([], [{
      sourcePath: "raw/sources/paper-a.pdf",
      kind: "file",
      value: "raw/sources/paper-a.pdf",
      fingerprint: "same-content",
    }], 100)
    const second = mergeCandidateDrafts(first, [{
      sourcePath: "raw/sources/copy-of-paper-a.pdf",
      kind: "file",
      value: "raw/sources/copy-of-paper-a.pdf",
      fingerprint: "same-content",
    }], 200)

    expect(second).toHaveLength(1)
    expect(second[0].id).toBe(first[0].id)
    expect(second[0].source.path).toBe("raw/sources/paper-a.pdf")
  })

  it("deduplicates URL candidates by normalized source identity when hashing is unavailable", () => {
    const first = mergeCandidateDrafts([], [{
      sourcePath: "raw/sources/example.html",
      kind: "url",
      value: "HTTPS://Example.com/paper#abstract",
      fingerprint: "",
    }], 100)
    const second = mergeCandidateDrafts(first, [{
      sourcePath: "raw/sources/example-2.html",
      kind: "url",
      value: "https://example.com/paper",
      fingerprint: "",
    }], 200)

    expect(second).toHaveLength(1)
    expect(second[0].id).toBe(first[0].id)
  })

  it("resets a modified source identity for screening while retaining one candidate", () => {
    const first = mergeCandidateDrafts([], [{
      sourcePath: "raw/sources/paper.pdf",
      kind: "file",
      value: "raw/sources/paper.pdf",
      fingerprint: "old-content",
    }], 100).map((candidate) => ({
      ...candidate,
      assessment: { ...candidate.assessment, status: "include" as const },
      queueTaskId: "old-task",
    }))
    const updated = mergeCandidateDrafts(first, [{
      sourcePath: "raw/sources/paper.pdf",
      kind: "file",
      value: "raw/sources/paper.pdf",
      fingerprint: "new-content",
    }], 200)

    expect(updated).toHaveLength(1)
    expect(updated[0]).toMatchObject({
      id: first[0].id,
      source: { fingerprint: "new-content" },
      assessment: { status: "registered" },
      queueTaskId: null,
      updatedAt: 200,
    })
  })

  it("migrates legacy arrays and normalizes malformed assessment values", () => {
    const candidates = normalizeCandidateStore([{
      id: "legacy",
      source: {
        kind: "file",
        value: "raw/sources/paper.pdf",
        path: "raw/sources/paper.pdf",
        fingerprint: "abc",
      },
      metadata: { title: "Paper" },
      assessment: {
        status: "maybe",
        relevance: "extreme",
        abstractionLevel: "workflow",
        contributionType: ["system", 42],
        rationale: "Useful",
        confidence: "certain",
      },
      createdAt: 10,
    }])

    expect(candidates).toEqual([
      expect.objectContaining({
        id: "legacy",
        assessment: {
          status: "registered",
          relevance: "unknown",
          abstractionLevel: "workflow",
          contributionType: ["system"],
          rationale: "Useful",
          confidence: "low",
        },
        queueTaskId: null,
        createdAt: 10,
        updatedAt: 10,
      }),
    ])
  })

  it("parses and validates bounded structured screening output", () => {
    expect(parseScreeningResponse(`Here is the result:
      {"status":"include","relevance":"core","abstractionLevel":"algorithm","contributionType":["method","evaluation"],"repositoryUrl":"https://github.com/example/repo","rationale":"Directly tests the central method.","confidence":"high"}`))
      .toEqual({
        status: "include",
        relevance: "core",
        abstractionLevel: "algorithm",
        contributionType: ["method", "evaluation"],
        repositoryUrl: "https://github.com/example/repo",
        rationale: "Directly tests the central method.",
        confidence: "high",
      })
  })

  it("extracts useful local metadata without a bibliographic service", () => {
    expect(extractLocalCandidateMetadata(
      "raw/sources/attention-is-all-you-need-2017.pdf",
      "# Attention Is All You Need\n\nVaswani et al.\n\nWe propose a new network architecture based solely on attention mechanisms.",
    )).toEqual({
      title: "Attention Is All You Need",
      authors: [],
      year: "2017",
      abstract: "Vaswani et al. We propose a new network architecture based solely on attention mechanisms.",
      repositoryUrl: "",
    })
  })
})
