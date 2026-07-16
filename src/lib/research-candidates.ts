import { getFileName, normalizePath } from "@/lib/path-utils"

export const RESEARCH_CANDIDATE_STATUSES = [
  "registered",
  "metadata_pending",
  "screening_pending",
  "include",
  "watch",
  "exclude",
  "queued",
  "processing",
  "complete",
  "failed",
] as const

export const RESEARCH_RELEVANCE_VALUES = [
  "core",
  "supporting",
  "peripheral",
  "unknown",
] as const

export const RESEARCH_ABSTRACTION_LEVELS = [
  "field",
  "workflow",
  "component",
  "algorithm",
  "implementation",
  "unknown",
] as const

export const RESEARCH_SCREENING_CONFIDENCE = ["low", "medium", "high"] as const

export type ResearchCandidateStatus = typeof RESEARCH_CANDIDATE_STATUSES[number]
export type ResearchRelevance = typeof RESEARCH_RELEVANCE_VALUES[number]
export type ResearchAbstractionLevel = typeof RESEARCH_ABSTRACTION_LEVELS[number]
export type ResearchScreeningConfidence = typeof RESEARCH_SCREENING_CONFIDENCE[number]

export interface ResearchCandidateSource {
  kind: "file" | "url"
  value: string
  path: string
  fingerprint: string
}

export interface ResearchCandidateMetadata {
  title: string
  authors: string[]
  year: string
  abstract: string
  repositoryUrl: string
}

export interface ResearchCandidateAssessment {
  status: ResearchCandidateStatus
  relevance: ResearchRelevance
  abstractionLevel: ResearchAbstractionLevel
  contributionType: string[]
  rationale: string
  confidence: ResearchScreeningConfidence
}

export interface ResearchCandidate {
  id: string
  source: ResearchCandidateSource
  metadata: ResearchCandidateMetadata
  assessment: ResearchCandidateAssessment
  queueTaskId: string | null
  createdAt: number
  updatedAt: number
}

export interface ResearchCandidateDraft {
  sourcePath: string
  kind: "file" | "url"
  value: string
  fingerprint: string
}

export interface ResearchScreeningResult {
  status: "include" | "watch" | "exclude"
  relevance: ResearchRelevance
  abstractionLevel: ResearchAbstractionLevel
  contributionType: string[]
  repositoryUrl: string
  rationale: string
  confidence: ResearchScreeningConfidence
}

const STATUS_SET = new Set<string>(RESEARCH_CANDIDATE_STATUSES)
const RELEVANCE_SET = new Set<string>(RESEARCH_RELEVANCE_VALUES)
const ABSTRACTION_SET = new Set<string>(RESEARCH_ABSTRACTION_LEVELS)
const CONFIDENCE_SET = new Set<string>(RESEARCH_SCREENING_CONFIDENCE)
const DECISION_SET = new Set<string>(["include", "watch", "exclude"])

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20))]
}

function enumValue<T extends string>(
  value: unknown,
  allowed: Set<string>,
  fallback: T,
): T {
  return typeof value === "string" && allowed.has(value) ? value as T : fallback
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export function researchCandidateId(
  source: Pick<ResearchCandidateSource, "kind" | "fingerprint" | "path" | "value">,
): string {
  const identity = source.fingerprint || researchCandidateSourceIdentity(source)
  return `candidate-${stableHash(identity)}`
}

export function researchCandidateSourceIdentity(
  source: Pick<ResearchCandidateSource, "kind" | "path" | "value">,
): string {
  if (source.kind === "url") {
    try {
      const url = new URL(source.value)
      url.hash = ""
      url.protocol = url.protocol.toLowerCase()
      url.hostname = url.hostname.toLowerCase()
      return `url:${url.toString()}`
    } catch {
      return `url:${source.value.trim()}`
    }
  }
  return `file:${normalizePath(source.path || source.value).toLowerCase()}`
}

function normalizeCandidate(raw: unknown): ResearchCandidate | null {
  if (!raw || typeof raw !== "object") return null
  const value = raw as Record<string, unknown>
  const sourceRaw = value.source && typeof value.source === "object"
    ? value.source as Record<string, unknown>
    : {}
  const metadataRaw = value.metadata && typeof value.metadata === "object"
    ? value.metadata as Record<string, unknown>
    : {}
  const assessmentRaw = value.assessment && typeof value.assessment === "object"
    ? value.assessment as Record<string, unknown>
    : {}
  const sourcePath = normalizePath(stringValue(sourceRaw.path) || stringValue(sourceRaw.value))
  if (!sourcePath) return null
  const source: ResearchCandidateSource = {
    kind: sourceRaw.kind === "url" ? "url" : "file",
    value: stringValue(sourceRaw.value) || sourcePath,
    path: sourcePath,
    fingerprint: stringValue(sourceRaw.fingerprint),
  }
  const createdAt = typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
    ? value.createdAt
    : Date.now()
  const updatedAt = typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
    ? value.updatedAt
    : createdAt
  return {
    id: stringValue(value.id) || researchCandidateId(source),
    source,
    metadata: {
      title: stringValue(metadataRaw.title),
      authors: stringList(metadataRaw.authors),
      year: stringValue(metadataRaw.year),
      abstract: stringValue(metadataRaw.abstract),
      repositoryUrl: stringValue(metadataRaw.repositoryUrl),
    },
    assessment: {
      status: enumValue(assessmentRaw.status, STATUS_SET, "registered"),
      relevance: enumValue(assessmentRaw.relevance, RELEVANCE_SET, "unknown"),
      abstractionLevel: enumValue(assessmentRaw.abstractionLevel, ABSTRACTION_SET, "unknown"),
      contributionType: stringList(assessmentRaw.contributionType),
      rationale: stringValue(assessmentRaw.rationale),
      confidence: enumValue(assessmentRaw.confidence, CONFIDENCE_SET, "low"),
    },
    queueTaskId: typeof value.queueTaskId === "string" && value.queueTaskId
      ? value.queueTaskId
      : null,
    createdAt,
    updatedAt,
  }
}

export function normalizeCandidateStore(raw: unknown): ResearchCandidate[] {
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { candidates?: unknown }).candidates)
      ? (raw as { candidates: unknown[] }).candidates
      : []
  const byIdentity = new Map<string, ResearchCandidate>()
  for (const entry of entries) {
    const candidate = normalizeCandidate(entry)
    if (!candidate) continue
    const key = candidate.source.fingerprint
      ? `fingerprint:${candidate.source.fingerprint}`
      : `identity:${researchCandidateSourceIdentity(candidate.source)}`
    const existing = byIdentity.get(key)
    if (!existing || candidate.updatedAt > existing.updatedAt) {
      byIdentity.set(key, candidate)
    }
  }
  return [...byIdentity.values()]
}

export function mergeCandidateDrafts(
  existing: ResearchCandidate[],
  drafts: ResearchCandidateDraft[],
  now = Date.now(),
): ResearchCandidate[] {
  const merged = normalizeCandidateStore(existing)
  const fingerprintIds = new Map(
    merged
      .filter((candidate) => candidate.source.fingerprint)
      .map((candidate) => [candidate.source.fingerprint, candidate.id]),
  )
  const identityIds = new Map(
    merged.map((candidate) => [
      researchCandidateSourceIdentity(candidate.source),
      candidate.id,
    ]),
  )

  for (const draft of drafts) {
    const path = normalizePath(draft.sourcePath)
    const identity = researchCandidateSourceIdentity({
      kind: draft.kind,
      path,
      value: draft.value,
    })
    const fingerprintDuplicateId = draft.fingerprint
      ? fingerprintIds.get(draft.fingerprint)
      : undefined
    if (fingerprintDuplicateId) continue
    const identityDuplicateId = identityIds.get(identity)
    if (identityDuplicateId) {
      const index = merged.findIndex((candidate) => candidate.id === identityDuplicateId)
      const candidate = merged[index]
      if (candidate && draft.fingerprint && candidate.source.fingerprint !== draft.fingerprint) {
        merged[index] = {
          ...candidate,
          source: { ...candidate.source, fingerprint: draft.fingerprint },
          assessment: { ...candidate.assessment, status: "registered" },
          queueTaskId: null,
          updatedAt: now,
        }
        fingerprintIds.set(draft.fingerprint, candidate.id)
      }
      continue
    }
    const source: ResearchCandidateSource = {
      kind: draft.kind,
      value: draft.value,
      path,
      fingerprint: draft.fingerprint,
    }
    const candidate: ResearchCandidate = {
      id: researchCandidateId(source),
      source,
      metadata: {
        title: getFileName(path).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim(),
        authors: [],
        year: path.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? "",
        abstract: "",
        repositoryUrl: "",
      },
      assessment: {
        status: "registered",
        relevance: "unknown",
        abstractionLevel: "unknown",
        contributionType: [],
        rationale: "",
        confidence: "low",
      },
      queueTaskId: null,
      createdAt: now,
      updatedAt: now,
    }
    merged.push(candidate)
    if (source.fingerprint) fingerprintIds.set(source.fingerprint, candidate.id)
    identityIds.set(identity, candidate.id)
  }
  return merged
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{")
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === "\\") {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === "{") depth++
    if (char === "}") {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

export function parseScreeningResponse(raw: string): ResearchScreeningResult | null {
  const json = extractFirstJsonObject(raw)
  if (!json) return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
  return {
    status: enumValue(parsed.status, DECISION_SET, "watch"),
    relevance: enumValue(parsed.relevance, RELEVANCE_SET, "unknown"),
    abstractionLevel: enumValue(parsed.abstractionLevel, ABSTRACTION_SET, "unknown"),
    contributionType: stringList(parsed.contributionType).slice(0, 8),
    repositoryUrl: stringValue(parsed.repositoryUrl),
    rationale: stringValue(parsed.rationale).slice(0, 600),
    confidence: enumValue(parsed.confidence, CONFIDENCE_SET, "low"),
  }
}

export function extractLocalCandidateMetadata(
  sourcePath: string,
  text: string,
): ResearchCandidateMetadata {
  const normalizedText = text.replace(/\r/g, "")
  const lines = normalizedText.split("\n").map((line) => line.trim()).filter(Boolean)
  const heading = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim()
  const htmlTitle = normalizedText.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const fallbackTitle = getFileName(sourcePath)
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const title = heading || htmlTitle || fallbackTitle
  const bodyLines = lines.filter((line) => !line.startsWith("#") && line !== title)
  const abstract = bodyLines
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_200)
  const year = `${sourcePath}\n${normalizedText.slice(0, 4_000)}`.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? ""
  const repositoryUrl = normalizedText.match(/https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org)\/[^\s<>"')]+/i)?.[0] ?? ""
  return {
    title,
    authors: [],
    year,
    abstract,
    repositoryUrl,
  }
}
