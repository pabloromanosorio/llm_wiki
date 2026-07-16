import { normalizePath } from "@/lib/path-utils"
import {
  loadResearchCandidates,
  updateResearchCandidates,
} from "@/lib/research-candidate-store"
import { enqueueSourceIngest } from "@/lib/source-lifecycle"
import { useActivityStore } from "@/stores/activity-store"
import type { LlmConfig } from "@/stores/wiki-store"
import type { WikiProject } from "@/types/wiki"

function absoluteSourcePath(projectPath: string, sourcePath: string): string {
  const path = normalizePath(sourcePath)
  return path.startsWith("/") || /^[A-Za-z]:\//.test(path) || path.startsWith("//")
    ? path
    : `${normalizePath(projectPath)}/${path}`
}

export async function enqueueIncludedResearchCandidates(
  project: WikiProject,
  llmConfig: LlmConfig,
  candidateIds?: string[],
): Promise<Awaited<ReturnType<typeof loadResearchCandidates>>> {
  const candidates = await loadResearchCandidates(project.path)
  const selected = candidateIds ? new Set(candidateIds) : null
  const included = candidates.filter((candidate) =>
    candidate.assessment.status === "include"
    && !candidate.queueTaskId
    && (!selected || selected.has(candidate.id)))
  if (included.length === 0) return candidates

  const activity = useActivityStore.getState()
  const activityId = activity.addItem({
    type: "ingest",
    title: "Queue included research candidates",
    status: "running",
    detail: `Sending ${included.length} included candidate(s) to the ingest queue...`,
    filesWritten: [],
  })
  try {
    const taskIds = await enqueueSourceIngest(
      project,
      included.map((candidate) => absoluteSourcePath(project.path, candidate.source.path)),
      llmConfig,
    )
    if (taskIds.length === 0) {
      activity.updateItem(activityId, {
        status: "error",
        detail: "No candidates were queued. Configure an ingest model and try again.",
      })
      return candidates
    }
    const taskByCandidate = new Map(
      included.slice(0, taskIds.length).map((candidate, index) => [candidate.id, taskIds[index]]),
    )
    const updated = await updateResearchCandidates(project.path, (items) =>
      items.map((candidate) => {
        const taskId = taskByCandidate.get(candidate.id)
        return taskId
          ? {
              ...candidate,
              assessment: { ...candidate.assessment, status: "queued" },
              queueTaskId: taskId,
              updatedAt: Date.now(),
            }
          : candidate
      }),
    )
    activity.updateItem(activityId, {
      status: "done",
      detail: `Queued ${taskIds.length} included candidate(s).`,
    })
    return updated
  } catch (error) {
    activity.updateItem(activityId, {
      status: "error",
      detail: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
