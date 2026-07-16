import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckSquare, Loader2, Play, ScanSearch } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  loadResearchCandidates,
  setResearchCandidateAssessment,
  setResearchCandidateDecision,
} from "@/lib/research-candidate-store"
import { enqueueIncludedResearchCandidates } from "@/lib/research-candidate-queue"
import {
  RESEARCH_ABSTRACTION_LEVELS,
  RESEARCH_RELEVANCE_VALUES,
  RESEARCH_SCREENING_CONFIDENCE,
  type ResearchCandidate,
  type ResearchCandidateAssessment,
} from "@/lib/research-candidates"
import { screenResearchCandidates } from "@/lib/research-screening"
import type { LlmConfig } from "@/stores/wiki-store"
import type { WikiProject } from "@/types/wiki"

interface ResearchCandidatePanelProps {
  project: WikiProject
  llmConfig: LlmConfig
  refreshKey: number
}

function editable(candidate: ResearchCandidate): boolean {
  return !["queued", "processing", "complete"].includes(candidate.assessment.status)
}

export function ResearchCandidatePanel({
  project,
  llmConfig,
  refreshKey,
}: ResearchCandidatePanelProps) {
  const { t } = useTranslation()
  const [candidates, setCandidates] = useState<ResearchCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<"screen" | "queue" | "decision" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setCandidates(await loadResearchCandidates(project.path))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [project.path])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  const selectable = useMemo(
    () => candidates.filter(editable),
    [candidates],
  )
  const allSelected = selectable.length > 0
    && selectable.every((candidate) => selected.has(candidate.id))
  const includedCount = candidates.filter((candidate) =>
    candidate.assessment.status === "include" && !candidate.queueTaskId).length

  function toggleAll() {
    setSelected(allSelected
      ? new Set()
      : new Set(selectable.map((candidate) => candidate.id)))
  }

  function toggleCandidate(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function decide(decision: "include" | "watch" | "exclude") {
    if (selected.size === 0) return
    setBusy("decision")
    setError(null)
    try {
      setCandidates(await setResearchCandidateDecision(
        project.path,
        [...selected],
        decision,
      ))
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function screen() {
    const ids = selected.size > 0
      ? [...selected]
      : candidates
        .filter((candidate) =>
          ["registered", "metadata_pending", "screening_pending", "failed"]
            .includes(candidate.assessment.status))
        .map((candidate) => candidate.id)
    if (ids.length === 0) return
    setBusy("screen")
    setError(null)
    try {
      setCandidates(await screenResearchCandidates(project, ids, llmConfig))
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function enqueueIncluded() {
    setBusy("queue")
    setError(null)
    try {
      setCandidates(await enqueueIncludedResearchCandidates(project, llmConfig))
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function updateAssessment(
    candidateId: string,
    patch: Partial<Omit<ResearchCandidateAssessment, "status">>,
  ) {
    setCandidates((items) => items.map((candidate) =>
      candidate.id === candidateId
        ? { ...candidate, assessment: { ...candidate.assessment, ...patch } }
        : candidate))
    try {
      setCandidates(await setResearchCandidateAssessment(project.path, candidateId, patch))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      await reload()
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="border-b bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">{t("sources.candidates.title")}</div>
        <p className="mt-1">{t("sources.candidates.empty")}</p>
        {error && <p className="mt-1 text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="border-b bg-muted/20">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="mr-auto">
          <div className="text-sm font-semibold">{t("sources.candidates.title")}</div>
          <div className="text-xs text-muted-foreground">
            {t("sources.candidates.summary", {
              count: candidates.length,
              included: includedCount,
            })}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={toggleAll} disabled={busy !== null}>
          <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
          {allSelected
            ? t("sources.candidates.clearSelection")
            : t("sources.candidates.selectAll")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void screen()} disabled={busy !== null}>
          {busy === "screen"
            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            : <ScanSearch className="mr-1.5 h-3.5 w-3.5" />}
          {t("sources.candidates.screen")}
        </Button>
        <Button size="sm" onClick={() => void enqueueIncluded()} disabled={busy !== null || includedCount === 0}>
          {busy === "queue"
            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            : <Play className="mr-1.5 h-3.5 w-3.5" />}
          {t("sources.candidates.queueIncluded", { count: includedCount })}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-y bg-background/60 px-4 py-2">
        <span className="self-center text-xs text-muted-foreground">
          {t("sources.candidates.selected", { count: selected.size })}
        </span>
        <Button variant="outline" size="sm" disabled={busy !== null || selected.size === 0} onClick={() => void decide("include")}>
          {t("sources.candidates.include")}
        </Button>
        <Button variant="outline" size="sm" disabled={busy !== null || selected.size === 0} onClick={() => void decide("watch")}>
          {t("sources.candidates.watch")}
        </Button>
        <Button variant="outline" size="sm" disabled={busy !== null || selected.size === 0} onClick={() => void decide("exclude")}>
          {t("sources.candidates.exclude")}
        </Button>
        {error && <span className="self-center text-xs text-destructive">{error}</span>}
      </div>

      <div className="max-h-72 overflow-auto">
        <table className="w-full min-w-[1050px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-2 py-2">{t("sources.candidates.source")}</th>
              <th className="px-2 py-2">{t("sources.candidates.status")}</th>
              <th className="px-2 py-2">{t("sources.candidates.relevance")}</th>
              <th className="px-2 py-2">{t("sources.candidates.abstraction")}</th>
              <th className="px-2 py-2">{t("sources.candidates.contribution")}</th>
              <th className="px-2 py-2">{t("sources.candidates.confidence")}</th>
              <th className="px-2 py-2">{t("sources.candidates.rationale")}</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => {
              const canEdit = editable(candidate)
              return (
                <tr key={candidate.id} className="border-t bg-background/80 align-top">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(candidate.id)}
                      disabled={!canEdit || busy !== null}
                      onChange={() => toggleCandidate(candidate.id)}
                      aria-label={t("sources.candidates.selectCandidate", {
                        title: candidate.metadata.title || candidate.source.path,
                      })}
                    />
                  </td>
                  <td className="max-w-64 px-2 py-2">
                    <div className="truncate font-medium" title={candidate.metadata.title}>
                      {candidate.metadata.title || candidate.source.path}
                    </div>
                    <div className="truncate text-muted-foreground" title={candidate.source.path}>
                      {candidate.source.path}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                      {t(`sources.candidates.statuses.${candidate.assessment.status}`)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="h-8 rounded border bg-background px-2"
                      disabled={!canEdit || busy !== null}
                      value={candidate.assessment.relevance}
                      onChange={(event) => void updateAssessment(candidate.id, {
                        relevance: event.target.value as ResearchCandidateAssessment["relevance"],
                      })}
                    >
                      {RESEARCH_RELEVANCE_VALUES.map((value) => (
                        <option key={value} value={value}>{t(`sources.candidates.values.${value}`)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="h-8 rounded border bg-background px-2"
                      disabled={!canEdit || busy !== null}
                      value={candidate.assessment.abstractionLevel}
                      onChange={(event) => void updateAssessment(candidate.id, {
                        abstractionLevel: event.target.value as ResearchCandidateAssessment["abstractionLevel"],
                      })}
                    >
                      {RESEARCH_ABSTRACTION_LEVELS.map((value) => (
                        <option key={value} value={value}>{t(`sources.candidates.values.${value}`)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      key={`${candidate.id}:${candidate.updatedAt}:contribution`}
                      className="h-8 min-w-44"
                      disabled={!canEdit || busy !== null}
                      defaultValue={candidate.assessment.contributionType.join(", ")}
                      onBlur={(event) => void updateAssessment(candidate.id, {
                        contributionType: event.target.value
                          .split(/[,，]/)
                          .map((value) => value.trim())
                          .filter(Boolean),
                      })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="h-8 rounded border bg-background px-2"
                      disabled={!canEdit || busy !== null}
                      value={candidate.assessment.confidence}
                      onChange={(event) => void updateAssessment(candidate.id, {
                        confidence: event.target.value as ResearchCandidateAssessment["confidence"],
                      })}
                    >
                      {RESEARCH_SCREENING_CONFIDENCE.map((value) => (
                        <option key={value} value={value}>{t(`sources.candidates.values.${value}`)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      key={`${candidate.id}:${candidate.updatedAt}:rationale`}
                      className="h-8 min-w-72"
                      disabled={!canEdit || busy !== null}
                      defaultValue={candidate.assessment.rationale}
                      onBlur={(event) => void updateAssessment(candidate.id, {
                        rationale: event.target.value,
                      })}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
