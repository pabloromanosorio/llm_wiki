import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enqueueSourceIngest: vi.fn(),
  loadResearchCandidates: vi.fn(),
  updateResearchCandidates: vi.fn(),
}))

vi.mock("@/lib/source-lifecycle", () => ({
  enqueueSourceIngest: mocks.enqueueSourceIngest,
}))
vi.mock("@/lib/research-candidate-store", () => ({
  loadResearchCandidates: mocks.loadResearchCandidates,
  updateResearchCandidates: mocks.updateResearchCandidates,
}))

import { enqueueIncludedResearchCandidates } from "./research-candidate-queue"
import type { ResearchCandidate, ResearchCandidateStatus } from "./research-candidates"

function candidate(id: string, status: ResearchCandidateStatus): ResearchCandidate {
  return {
    id,
    source: {
      kind: "file",
      value: `raw/sources/${id}.pdf`,
      path: `raw/sources/${id}.pdf`,
      fingerprint: id,
    },
    metadata: { title: id, authors: [], year: "", abstract: "", repositoryUrl: "" },
    assessment: {
      status,
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
  let items = [
    candidate("included", "include"),
    candidate("watched", "watch"),
    candidate("excluded", "exclude"),
  ]
  mocks.loadResearchCandidates.mockImplementation(async () => items)
  mocks.updateResearchCandidates.mockImplementation(async (_path, updater) => {
    items = await updater(items)
    return items
  })
  mocks.enqueueSourceIngest.mockResolvedValue(["task-included"])
})

describe("Research candidate queue handoff", () => {
  it("sends only included candidates through the existing ingest queue in one batch", async () => {
    const queued = await enqueueIncludedResearchCandidates(
      { id: "p1", name: "Research", path: "/project" },
      { provider: "openai", apiKey: "key", model: "model" } as never,
    )

    expect(mocks.enqueueSourceIngest).toHaveBeenCalledOnce()
    expect(mocks.enqueueSourceIngest).toHaveBeenCalledWith(
      { id: "p1", name: "Research", path: "/project" },
      ["/project/raw/sources/included.pdf"],
      expect.any(Object),
    )
    expect(queued.find((item) => item.id === "included")).toMatchObject({
      assessment: { status: "queued" },
      queueTaskId: "task-included",
    })
    expect(queued.find((item) => item.id === "watched")?.assessment.status).toBe("watch")
    expect(queued.find((item) => item.id === "excluded")?.assessment.status).toBe("exclude")
  })

  it("keeps included decisions retryable when the queue cannot accept them", async () => {
    mocks.enqueueSourceIngest.mockResolvedValue([])

    const queued = await enqueueIncludedResearchCandidates(
      { id: "p1", name: "Research", path: "/project" },
      { provider: "openai", apiKey: "", model: "" } as never,
    )

    expect(queued.find((item) => item.id === "included")?.assessment.status).toBe("include")
    expect(queued.find((item) => item.id === "included")?.queueTaskId).toBeNull()
  })

  it("queues only the requested included candidates for a per-source ingest action", async () => {
    const secondIncluded = candidate("second-included", "include")
    mocks.loadResearchCandidates.mockResolvedValue([
      candidate("included", "include"),
      secondIncluded,
    ])
    mocks.updateResearchCandidates.mockImplementation(async (_path, updater) =>
      updater([
        candidate("included", "include"),
        secondIncluded,
      ]))

    await enqueueIncludedResearchCandidates(
      { id: "p1", name: "Research", path: "/project" },
      { provider: "openai", apiKey: "key", model: "model" } as never,
      ["second-included"],
    )

    expect(mocks.enqueueSourceIngest).toHaveBeenCalledWith(
      { id: "p1", name: "Research", path: "/project" },
      ["/project/raw/sources/second-included.pdf"],
      expect.any(Object),
    )
  })
})
