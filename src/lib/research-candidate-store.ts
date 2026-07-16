import {
  createDirectory,
  fileExists,
  getFileMd5,
  readFile,
  writeFileAtomic,
} from "@/commands/fs"
import {
  mergeCandidateDrafts,
  normalizeCandidateStore,
  researchCandidateSourceIdentity,
  type ResearchCandidate,
  type ResearchCandidateAssessment,
  type ResearchCandidateDraft,
} from "@/lib/research-candidates"
import { isAbsolutePath, normalizePath } from "@/lib/path-utils"
import type { WikiProject } from "@/types/wiki"

const STORE_VERSION = 1
const STORE_FILE = ".llm-wiki/research-candidates.json"
const updateChains = new Map<string, Promise<void>>()

function storePath(projectPath: string): string {
  return `${normalizePath(projectPath)}/${STORE_FILE}`
}

async function readCandidates(projectPath: string): Promise<ResearchCandidate[]> {
  const path = storePath(projectPath)
  if (!await fileExists(path)) return []
  const raw = await readFile(path)
  try {
    return normalizeCandidateStore(JSON.parse(raw))
  } catch {
    throw new Error(`Research candidate store is malformed: ${path}`)
  }
}

async function writeCandidates(
  projectPath: string,
  candidates: ResearchCandidate[],
): Promise<void> {
  const pp = normalizePath(projectPath)
  await createDirectory(`${pp}/.llm-wiki`).catch(() => {})
  await writeFileAtomic(
    storePath(pp),
    JSON.stringify({
      version: STORE_VERSION,
      candidates: normalizeCandidateStore(candidates),
    }, null, 2),
  )
}

export async function loadResearchCandidates(
  projectPath: string,
): Promise<ResearchCandidate[]> {
  return readCandidates(projectPath)
}

export async function updateResearchCandidates(
  projectPath: string,
  updater: (candidates: ResearchCandidate[]) => ResearchCandidate[] | Promise<ResearchCandidate[]>,
): Promise<ResearchCandidate[]> {
  const key = normalizePath(projectPath)
  const previous = updateChains.get(key) ?? Promise.resolve()
  let result: ResearchCandidate[] = []
  const run = previous
    .catch(() => {})
    .then(async () => {
      result = normalizeCandidateStore(await updater(await readCandidates(key)))
      await writeCandidates(key, result)
    })
  updateChains.set(key, run)
  try {
    await run
    return result
  } finally {
    if (updateChains.get(key) === run) updateChains.delete(key)
  }
}

function relativeCandidatePath(projectPath: string, sourcePath: string): string {
  const pp = normalizePath(projectPath).replace(/\/+$/, "")
  const path = normalizePath(sourcePath)
  if (path.startsWith(`${pp}/`)) return path.slice(pp.length + 1)
  return path
}

function absoluteCandidatePath(projectPath: string, sourcePath: string): string {
  const path = normalizePath(sourcePath)
  return isAbsolutePath(path) ? path : `${normalizePath(projectPath)}/${path}`
}

export async function registerResearchCandidatePaths(
  project: WikiProject,
  sourcePaths: string[],
  sourceOptions: Record<string, { kind?: "file" | "url"; value?: string }> = {},
): Promise<ResearchCandidate[]> {
  const drafts: ResearchCandidateDraft[] = []
  for (const sourcePath of sourcePaths) {
    const absolutePath = absoluteCandidatePath(project.path, sourcePath)
    const relativePath = relativeCandidatePath(project.path, absolutePath)
    let fingerprint = ""
    try {
      fingerprint = await getFileMd5(absolutePath)
    } catch {
      // Source identity remains a stable fallback when hashing is unavailable.
    }
    const options = sourceOptions[normalizePath(sourcePath)]
      ?? sourceOptions[absolutePath]
      ?? sourceOptions[relativePath]
    drafts.push({
      sourcePath: relativePath,
      kind: options?.kind ?? "file",
      value: options?.value ?? relativePath,
      fingerprint,
    })
  }

  const updated = await updateResearchCandidates(
    project.path,
    (existing) => mergeCandidateDrafts(existing, drafts),
  )
  const requestedFingerprints = new Set(drafts.map((draft) => draft.fingerprint).filter(Boolean))
  const requestedPaths = new Set(drafts.map((draft) => normalizePath(draft.sourcePath).toLowerCase()))
  const requestedIdentities = new Set(drafts.map((draft) =>
    researchCandidateSourceIdentity({
      kind: draft.kind,
      path: draft.sourcePath,
      value: draft.value,
    })))
  return updated.filter((candidate) =>
    (candidate.source.fingerprint && requestedFingerprints.has(candidate.source.fingerprint))
    || requestedPaths.has(normalizePath(candidate.source.path).toLowerCase())
    || requestedIdentities.has(researchCandidateSourceIdentity(candidate.source)),
  )
}

export async function setResearchCandidateDecision(
  projectPath: string,
  candidateIds: string[],
  decision: "include" | "watch" | "exclude",
): Promise<ResearchCandidate[]> {
  const selected = new Set(candidateIds)
  const now = Date.now()
  return updateResearchCandidates(projectPath, (candidates) =>
    candidates.map((candidate) =>
      selected.has(candidate.id)
        ? {
            ...candidate,
            assessment: { ...candidate.assessment, status: decision },
            queueTaskId: decision === "include" ? null : candidate.queueTaskId,
            updatedAt: now,
          }
        : candidate,
    ),
  )
}

export async function setResearchCandidateAssessment(
  projectPath: string,
  candidateId: string,
  assessment: Partial<Omit<ResearchCandidateAssessment, "status">>,
): Promise<ResearchCandidate[]> {
  const now = Date.now()
  return updateResearchCandidates(projectPath, (candidates) =>
    candidates.map((candidate) =>
      candidate.id === candidateId
        ? {
            ...candidate,
            assessment: { ...candidate.assessment, ...assessment },
            updatedAt: now,
          }
        : candidate,
    ),
  )
}

export async function migrateResearchCandidatePath(
  projectPath: string,
  oldSourcePath: string,
  newSourcePath: string,
): Promise<ResearchCandidate[]> {
  const existing = await loadResearchCandidates(projectPath)
  if (existing.length === 0) return existing
  const oldPath = relativeCandidatePath(projectPath, oldSourcePath).toLowerCase()
  const newPath = relativeCandidatePath(projectPath, newSourcePath)
  const now = Date.now()
  return updateResearchCandidates(projectPath, (candidates) =>
    candidates.map((candidate) => {
      if (normalizePath(candidate.source.path).toLowerCase() !== oldPath) return candidate
      return {
        ...candidate,
        source: {
          ...candidate.source,
          path: newPath,
          value: candidate.source.kind === "file" ? newPath : candidate.source.value,
        },
        updatedAt: now,
      }
    }),
  )
}

export async function removeResearchCandidatesByPaths(
  projectPath: string,
  sourcePaths: string[],
): Promise<ResearchCandidate[]> {
  const existing = await loadResearchCandidates(projectPath)
  if (existing.length === 0) return existing
  const deleting = new Set(sourcePaths.map((sourcePath) =>
    relativeCandidatePath(projectPath, sourcePath).toLowerCase()))
  return updateResearchCandidates(projectPath, (candidates) =>
    candidates.filter((candidate) =>
      !deleting.has(normalizePath(candidate.source.path).toLowerCase())),
  )
}
