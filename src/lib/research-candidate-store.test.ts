import { beforeEach, describe, expect, it, vi } from "vitest"

const fsMocks = vi.hoisted(() => ({
  createDirectory: vi.fn(),
  fileExists: vi.fn(),
  getFileMd5: vi.fn(),
  readFile: vi.fn(),
  writeFileAtomic: vi.fn(),
}))

vi.mock("@/commands/fs", () => fsMocks)

import {
  loadResearchCandidates,
  migrateResearchCandidatePath,
  registerResearchCandidatePaths,
  removeResearchCandidatesByPaths,
  setResearchCandidateAssessment,
  setResearchCandidateDecision,
  updateResearchCandidates,
} from "./research-candidate-store"

beforeEach(() => {
  vi.clearAllMocks()
  fsMocks.createDirectory.mockResolvedValue(undefined)
  fsMocks.fileExists.mockResolvedValue(false)
  fsMocks.getFileMd5.mockResolvedValue("fingerprint")
  fsMocks.readFile.mockRejectedValue(new Error("missing"))
  fsMocks.writeFileAtomic.mockResolvedValue(undefined)
})

describe("Research candidate persistence", () => {
  it("persists one project-scoped atomic store and does not start ingest", async () => {
    const candidates = await registerResearchCandidatePaths(
      { id: "p1", name: "Research", path: "/project" },
      ["/project/raw/sources/paper.pdf"],
    )

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      source: {
        kind: "file",
        value: "raw/sources/paper.pdf",
        path: "raw/sources/paper.pdf",
        fingerprint: "fingerprint",
      },
      assessment: { status: "registered" },
    })
    expect(fsMocks.writeFileAtomic).toHaveBeenCalledWith(
      "/project/.llm-wiki/research-candidates.json",
      expect.stringContaining('"version": 1'),
    )
  })

  it("loads legacy array data without rewriting it or losing decisions", async () => {
    fsMocks.fileExists.mockResolvedValue(true)
    fsMocks.readFile.mockResolvedValue(JSON.stringify([{
      id: "legacy",
      source: {
        kind: "file",
        value: "raw/sources/paper.pdf",
        path: "raw/sources/paper.pdf",
        fingerprint: "abc",
      },
      metadata: {},
      assessment: { status: "watch" },
      queueTaskId: null,
      createdAt: 1,
      updatedAt: 2,
    }]))

    const loaded = await loadResearchCandidates("/project")

    expect(loaded[0].assessment.status).toBe("watch")
    expect(fsMocks.writeFileAtomic).not.toHaveBeenCalled()
  })

  it("refuses to overwrite a malformed existing store", async () => {
    fsMocks.fileExists.mockResolvedValue(true)
    fsMocks.readFile.mockResolvedValue("{not-json")

    await expect(setResearchCandidateDecision(
      "/project",
      ["candidate-1"],
      "include",
    )).rejects.toThrow("malformed")
    expect(fsMocks.writeFileAtomic).not.toHaveBeenCalled()
  })

  it("serializes read-modify-write updates so concurrent decisions are not lost", async () => {
    fsMocks.fileExists.mockResolvedValue(true)
    let disk = JSON.stringify({ version: 1, candidates: [] })
    fsMocks.readFile.mockImplementation(async () => disk)
    fsMocks.writeFileAtomic.mockImplementation(async (_path: string, contents: string) => {
      disk = contents
    })

    await Promise.all([
      updateResearchCandidates("/project", (items) => [
        ...items,
        {
          id: "a",
          source: { kind: "file", value: "a.pdf", path: "raw/sources/a.pdf", fingerprint: "a" },
          metadata: { title: "A", authors: [], year: "", abstract: "", repositoryUrl: "" },
          assessment: {
            status: "include",
            relevance: "core",
            abstractionLevel: "unknown",
            contributionType: [],
            rationale: "",
            confidence: "low",
          },
          queueTaskId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
      updateResearchCandidates("/project", (items) => [
        ...items,
        {
          id: "b",
          source: { kind: "file", value: "b.pdf", path: "raw/sources/b.pdf", fingerprint: "b" },
          metadata: { title: "B", authors: [], year: "", abstract: "", repositoryUrl: "" },
          assessment: {
            status: "watch",
            relevance: "supporting",
            abstractionLevel: "unknown",
            contributionType: [],
            rationale: "",
            confidence: "low",
          },
          queueTaskId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    ])

    const persisted = JSON.parse(disk) as { candidates: Array<{ id: string }> }
    expect(persisted.candidates.map((candidate) => candidate.id)).toEqual(["a", "b"])
  })

  it("persists batch decisions and editable classification fields", async () => {
    fsMocks.fileExists.mockResolvedValue(true)
    let disk = JSON.stringify({
      version: 1,
      candidates: [{
        id: "candidate-1",
        source: {
          kind: "file",
          value: "raw/sources/paper.pdf",
          path: "raw/sources/paper.pdf",
          fingerprint: "abc",
        },
        metadata: {},
        assessment: { status: "registered" },
        queueTaskId: null,
        createdAt: 1,
        updatedAt: 1,
      }],
    })
    fsMocks.readFile.mockImplementation(async () => disk)
    fsMocks.writeFileAtomic.mockImplementation(async (_path: string, contents: string) => {
      disk = contents
    })

    await setResearchCandidateDecision("/project", ["candidate-1"], "watch")
    const updated = await setResearchCandidateAssessment("/project", "candidate-1", {
      relevance: "supporting",
      abstractionLevel: "component",
      contributionType: ["system", "evaluation"],
      rationale: "Useful implementation detail.",
      confidence: "medium",
    })

    expect(updated[0].assessment).toMatchObject({
      status: "watch",
      relevance: "supporting",
      abstractionLevel: "component",
      contributionType: ["system", "evaluation"],
      rationale: "Useful implementation detail.",
      confidence: "medium",
    })
  })

  it("migrates candidate paths without changing identity or decisions", async () => {
    fsMocks.fileExists.mockResolvedValue(true)
    let disk = JSON.stringify({
      version: 1,
      candidates: [{
        id: "candidate-1",
        source: {
          kind: "file",
          value: "raw/sources/old/paper.pdf",
          path: "raw/sources/old/paper.pdf",
          fingerprint: "abc",
        },
        metadata: {},
        assessment: { status: "watch" },
        queueTaskId: null,
        createdAt: 1,
        updatedAt: 1,
      }],
    })
    fsMocks.readFile.mockImplementation(async () => disk)
    fsMocks.writeFileAtomic.mockImplementation(async (_path: string, contents: string) => {
      disk = contents
    })

    const migrated = await migrateResearchCandidatePath(
      "/project",
      "raw/sources/old/paper.pdf",
      "raw/sources/new/paper.pdf",
    )

    expect(migrated[0]).toMatchObject({
      id: "candidate-1",
      source: {
        value: "raw/sources/new/paper.pdf",
        path: "raw/sources/new/paper.pdf",
        fingerprint: "abc",
      },
      assessment: { status: "watch" },
    })
  })

  it("removes candidates when their source is deleted", async () => {
    fsMocks.fileExists.mockResolvedValue(true)
    let disk = JSON.stringify({
      version: 1,
      candidates: [{
        id: "candidate-1",
        source: {
          kind: "file",
          value: "raw/sources/paper.pdf",
          path: "raw/sources/paper.pdf",
          fingerprint: "abc",
        },
        metadata: {},
        assessment: { status: "exclude" },
        queueTaskId: null,
        createdAt: 1,
        updatedAt: 1,
      }],
    })
    fsMocks.readFile.mockImplementation(async () => disk)
    fsMocks.writeFileAtomic.mockImplementation(async (_path: string, contents: string) => {
      disk = contents
    })

    expect(await removeResearchCandidatesByPaths(
      "/project",
      ["/project/raw/sources/paper.pdf"],
    )).toEqual([])
  })
})
