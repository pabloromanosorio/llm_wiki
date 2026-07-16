import { readFile, readFileExcerpt } from "@/commands/fs"
import { hasUsableLlm } from "@/lib/has-usable-llm"
import { streamChat } from "@/lib/llm-client"
import { getTaskLlmConfig } from "@/lib/llm-task-routing"
import { normalizePath } from "@/lib/path-utils"
import {
  updateResearchCandidates,
} from "@/lib/research-candidate-store"
import {
  extractLocalCandidateMetadata,
  parseScreeningResponse,
  type ResearchCandidate,
} from "@/lib/research-candidates"
import { useActivityStore } from "@/stores/activity-store"
import { useReviewStore } from "@/stores/review-store"
import type { LlmConfig } from "@/stores/wiki-store"
import type { WikiProject } from "@/types/wiki"

const SCREENING_SOURCE_CHARS = 14_000
const SCREENING_MAX_TOKENS = 1_200

const SCREENING_SYSTEM_PROMPT = `You are performing bounded research candidate screening.
Classify only whether this source should be included, watched, or excluded for the project's stated purpose.
Do not generate wiki pages, FILE blocks, review items, long-form analysis, or chain-of-thought.

Return one JSON object only:
{
  "status": "include | watch | exclude",
  "relevance": "core | supporting | peripheral | unknown",
  "abstractionLevel": "field | workflow | component | algorithm | implementation | unknown",
  "contributionType": ["short-label"],
  "repositoryUrl": "",
  "rationale": "one short sentence",
  "confidence": "low | medium | high"
}`

function sectionBody(markdown: string, heading: string): string {
  const match = markdown.match(new RegExp(
    `^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
    "mi",
  ))
  return match?.[1] ?? ""
}

function hasMeaningfulPurposeText(value: string): boolean {
  const cleaned = value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\*\*(?:In scope|Out of scope):\*\*/gi, " ")
    .replace(/\b(?:TBD|Not started)\b/gi, " ")
    .replace(/[#>*_`[\]().:;,\-\d]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return /[\p{L}\p{N}]{3}/u.test(cleaned)
}

export function researchPurposeReadiness(
  purpose: string,
): { ready: boolean; missing: string[] } {
  const missing: string[] = []
  if (!hasMeaningfulPurposeText(sectionBody(purpose, "Research Question"))) {
    missing.push("Research Question")
  }
  if (!hasMeaningfulPurposeText(sectionBody(purpose, "Scope"))) {
    missing.push("Scope")
  }
  return { ready: missing.length === 0, missing }
}

function absoluteSourcePath(projectPath: string, sourcePath: string): string {
  const path = normalizePath(sourcePath)
  return path.startsWith("/") || /^[A-Za-z]:\//.test(path) || path.startsWith("//")
    ? path
    : `${normalizePath(projectPath)}/${path}`
}

function applyCandidateUpdate(
  candidates: ResearchCandidate[],
  candidateId: string,
  update: (candidate: ResearchCandidate) => ResearchCandidate,
): ResearchCandidate[] {
  return candidates.map((candidate) =>
    candidate.id === candidateId ? update(candidate) : candidate,
  )
}

export async function screenResearchCandidates(
  project: WikiProject,
  candidateIds: string[],
  llmConfig: LlmConfig,
): Promise<ResearchCandidate[]> {
  const selected = new Set(candidateIds)
  const activity = useActivityStore.getState()
  const activityId = activity.addItem({
    type: "ingest",
    title: "Screen research candidates",
    status: "running",
    detail: `Screening ${selected.size} candidate(s)...`,
    filesWritten: [],
  })
  let purpose = ""
  try {
    purpose = await readFile(`${normalizePath(project.path)}/purpose.md`)
  } catch {
    // Missing purpose is handled by the same readiness gate as an empty file.
  }
  const readiness = researchPurposeReadiness(purpose)
  if (!readiness.ready) {
    useReviewStore.getState().addItem({
      type: "suggestion",
      title: "Complete Research purpose before screening",
      description: `Add the minimum purpose fields before screening a large candidate batch: ${readiness.missing.join(", ")}.`,
      sourcePath: "purpose.md",
      affectedPages: ["purpose.md"],
      options: [
        { label: "Open purpose.md", action: "open-purpose" },
        { label: "Skip", action: "skip" },
      ],
    })
    activity.updateItem(activityId, {
      status: "error",
      detail: `Research purpose needs: ${readiness.missing.join(", ")}.`,
    })
    return updateResearchCandidates(project.path, (items) =>
      items.map((candidate) =>
        selected.has(candidate.id) && candidate.assessment.status === "screening_pending"
          ? {
              ...candidate,
              assessment: { ...candidate.assessment, status: "registered" },
              updatedAt: Date.now(),
            }
          : candidate,
      ),
    )
  }
  let candidates = await updateResearchCandidates(project.path, (items) =>
    items.map((candidate) =>
      selected.has(candidate.id) && !candidate.queueTaskId
        ? {
            ...candidate,
            assessment: { ...candidate.assessment, status: "screening_pending" },
            updatedAt: Date.now(),
          }
        : candidate,
    ),
  )
  const screeningLlm = getTaskLlmConfig("ingest", llmConfig)
  const useModel = hasUsableLlm(screeningLlm)

  for (const candidate of candidates.filter((item) => selected.has(item.id) && !item.queueTaskId)) {
    const sourcePath = absoluteSourcePath(project.path, candidate.source.path)
    try {
      const sourceText = await readFileExcerpt(sourcePath, {
        maxChars: SCREENING_SOURCE_CHARS,
        maxPdfPages: 2,
      })
      const metadata = extractLocalCandidateMetadata(candidate.source.path, sourceText)
      if (!useModel) {
        candidates = await updateResearchCandidates(project.path, (items) =>
          applyCandidateUpdate(items, candidate.id, (item) => ({
            ...item,
            metadata: { ...item.metadata, ...metadata },
            assessment: {
              ...item.assessment,
              status: "watch",
              relevance: "unknown",
              abstractionLevel: "unknown",
              contributionType: [],
              rationale: "Local metadata extracted; model screening is not configured.",
              confidence: "low",
            },
            updatedAt: Date.now(),
          })),
        )
        continue
      }

      let raw = ""
      let streamError: Error | null = null
      await streamChat(
        screeningLlm,
        [
          { role: "system", content: SCREENING_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `Project: ${project.name}`,
              `Project purpose:\n${purpose.slice(0, 6_000)}`,
              `Source: ${candidate.source.value}`,
              `Local title: ${metadata.title}`,
              `Local year: ${metadata.year}`,
              "",
              sourceText.slice(0, SCREENING_SOURCE_CHARS),
            ].join("\n"),
          },
        ],
        {
          onToken: (token) => {
            raw += token
          },
          onDone: () => {},
          onError: (error) => {
            streamError = error
          },
        },
        undefined,
        {
          temperature: 0.1,
          reasoning: { mode: "off" },
          max_tokens: SCREENING_MAX_TOKENS,
        },
      )
      if (streamError) throw streamError
      const result = parseScreeningResponse(raw)
      if (!result) throw new Error("Screening model returned invalid structured output")
      candidates = await updateResearchCandidates(project.path, (items) =>
        applyCandidateUpdate(items, candidate.id, (item) => ({
          ...item,
          metadata: {
            ...item.metadata,
            ...metadata,
            repositoryUrl: result.repositoryUrl || metadata.repositoryUrl,
          },
          assessment: {
            status: result.status,
            relevance: result.relevance,
            abstractionLevel: result.abstractionLevel,
            contributionType: result.contributionType,
            rationale: result.rationale,
            confidence: result.confidence,
          },
          updatedAt: Date.now(),
        })),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      candidates = await updateResearchCandidates(project.path, (items) =>
        applyCandidateUpdate(items, candidate.id, (item) => ({
          ...item,
          assessment: {
            ...item.assessment,
            status: "failed",
            rationale: message.slice(0, 600),
            confidence: "low",
          },
          updatedAt: Date.now(),
        })),
      )
    }
  }

  activity.updateItem(activityId, {
    status: candidates.some((candidate) =>
      selected.has(candidate.id) && candidate.assessment.status === "failed")
      ? "error"
      : "done",
    detail: `Screened ${selected.size} candidate(s).`,
  })
  return candidates
}
